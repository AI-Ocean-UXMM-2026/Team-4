import asyncio
import json
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import httpx

from app.features.ai.context_builder import build_context
from app.features.ai.llm_client import AIWordingClient
from app.features.ai.parser import grounded_insights
from app.features.ai.schemas import SnapshotBundle
from app.features.ai.service import AnalysisService, _cache, _call_times, _latest, _locks, provider_failure_warning
from app.features.ai.snapshot_provider import _optional_snapshot


def bundle(version=2, synthetic=True, loan=False):
    return SnapshotBundle(
        business_id="biz-a", source_version=version, import_batch_id=f"batch-{version}",
        financial={
            "business_id": "biz-a", "source_version": version, "synthetic": synthetic,
            "as_of": datetime.now(timezone.utc).isoformat(),
            "actual": {
                "cash_balance_mmk": "100000", "receivables_mmk": "200000",
                "payables_mmk": "500000",
            },
            "upcoming_obligations": [], "data_quality": {"status": "partial", "warnings": []},
        },
        credit={
            "business_id": "biz-a", "source_version": version, "synthetic": synthetic,
            "loans": [{"loan_id": "loan-a"}] if loan else [],
            "repayment": {"assessment": "estimated_from_recorded_cash",
                          "available_cash_mmk": "100000", "upcoming_due_mmk": "140000",
                          "difference_mmk": "-40000"},
        },
    )


class Provider:
    def __init__(self, snapshot):
        self.snapshot = snapshot
        self.current_version = snapshot.source_version

    def load(self, business_id):
        return self.snapshot

    def version(self, business_id):
        return self.current_version


class Client:
    api_key = "test-key"

    def __init__(self, result=None, error=None):
        self.result, self.error = result, error
        self.calls = 0

    async def explain(self, insights, context):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result or {"items": [
            {"flag_id": item.id, "explanation": item.explanation,
             "suggested_action": item.suggested_actions[0]} for item in insights
        ]}


def test_credit_balance_error_has_actionable_fallback_warning():
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(429, request=request,
                              json={"error": {"code": "credit_balance_exhausted", "type": "insufficient_quota"}})
    error = httpx.HTTPStatusError("failed", request=request, response=response)
    assert "credits are exhausted" in provider_failure_warning(error)


def test_openrouter_payment_error_names_selected_provider():
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/responses")
    response = httpx.Response(402, request=request, json={"error": {"message": "Payment required"}})
    error = httpx.HTTPStatusError("failed", request=request, response=response)
    assert provider_failure_warning(error, "OpenRouter") == (
        "OpenRouter account has insufficient credits; rules-based findings are shown."
    )


def test_openrouter_settings_select_its_own_key_and_model(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "router-key")
    client = AIWordingClient()
    assert client.api_key == "router-key"
    assert client.model == "openai/gpt-5-mini"
    assert client.endpoint == "https://openrouter.ai/api/v1/responses"


def test_openrouter_request_uses_responses_endpoint_and_schema(monkeypatch):
    sent = []

    def respond(request):
        sent.append(request)
        return httpx.Response(200, json={
            "status": "completed",
            "output": [{"content": [{"type": "output_text", "text": json.dumps({"items": []})}]}],
        })

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        "app.features.ai.llm_client.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs),
    )
    client = AIWordingClient(api_key="router-key", provider="openrouter")
    result = asyncio.run(client.explain([], {"metrics": {"cash_balance_mmk": 100}, "wording_retry": True}))
    assert result == {"items": []}
    assert len(sent) == 1
    assert str(sent[0].url) == "https://openrouter.ai/api/v1/responses"
    assert sent[0].headers["authorization"] == "Bearer router-key"
    body = json.loads(sent[0].content)
    assert body["model"] == "openai/gpt-5-mini"
    assert body["provider"] == {"require_parameters": True}
    assert body["reasoning"] == {"effort": "minimal"}
    assert body["max_output_tokens"] == 2000
    assert "validation retry" in body["instructions"]
    assert "wording_retry" not in body["input"]
    assert body["text"]["format"]["type"] == "json_schema"
    assert body["store"] is False


@pytest.fixture(autouse=True)
def clear_cache():
    _cache.clear()
    _latest.clear()
    _call_times.clear()
    _locks.clear()


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_synthetic_report_uses_grounded_evidence_and_reuses_same_import():
    provider, client = Provider(bundle()), Client()
    service = AnalysisService(provider, client)
    first = await service.analyze("biz-a")
    second = await service.analyze("biz-a")
    assert first.status == "completed"
    assert first.insights[0].evidence[0].value == 200000
    assert all(insight.id != "repayment-review" for insight in first.insights)
    assert second.generated_at == first.generated_at
    assert client.calls == 1
    provider.current_version = 3
    assert service.latest("biz-a").outdated is True


@pytest.mark.anyio
async def test_model_timeout_yields_honest_rules_only():
    result = await AnalysisService(Provider(bundle()), Client(error=TimeoutError())).analyze("biz-a")
    assert result.status == "rules_only"
    assert "AI wording was unavailable" in result.warnings[-1]


@pytest.mark.anyio
async def test_real_data_is_never_sent_to_provider():
    client = Client()
    result = await AnalysisService(Provider(bundle(synthetic=False)), client).analyze("biz-a")
    assert result.status == "rules_only"
    assert client.calls == 0


@pytest.mark.anyio
async def test_cross_business_input_rejected():
    with pytest.raises(PermissionError):
        await AnalysisService(Provider(bundle()), Client()).analyze("biz-b")
    wrong = bundle().model_copy(update={"credit": {"business_id": "biz-b"}})
    with pytest.raises(PermissionError):
        build_context(wrong)


@pytest.mark.anyio
async def test_missing_source_is_insufficient():
    empty = SnapshotBundle(business_id="biz-a", source_version=0)
    result = await AnalysisService(Provider(empty), Client()).analyze("biz-a")
    assert result.status == "insufficient_data"
    assert result.insights == []


@pytest.mark.anyio
async def test_no_loan_does_not_create_repayment_warning():
    result = await AnalysisService(Provider(bundle(loan=False)), Client()).analyze("biz-a")
    assert "repayment-review" not in [item.id for item in result.insights]


@pytest.mark.anyio
async def test_invented_model_numbers_revert_to_rules():
    class InventingClient(Client):
        async def explain(self, insights, context):
            result = await super().explain(insights, context)
            result["items"][0]["explanation"] = "Cash will rise by 900000 MMK."
            return result
    client = InventingClient()
    service = AnalysisService(Provider(bundle()), client)
    result = await service.analyze("biz-a")
    assert result.status == "rules_only"
    assert all("900000" not in item.explanation for item in result.insights)
    assert "evidence validation" in result.warnings[-1]
    assert client.calls == 2
    await service.analyze("biz-a")
    assert client.calls == 4  # A failed provider result must not be cached.


@pytest.mark.anyio
async def test_invalid_wording_retries_once_with_stricter_context():
    class RecoveringClient(Client):
        async def explain(self, insights, context):
            result = await super().explain(insights, context)
            if self.calls == 1:
                result["items"][0]["explanation"] = "Cash will rise by 900000 MMK."
            else:
                assert context["wording_retry"] is True
            return result

    client = RecoveringClient()
    result = await AnalysisService(Provider(bundle()), client).analyze("biz-a")
    assert result.status == "completed"
    assert client.calls == 2


@pytest.mark.anyio
async def test_dated_supplier_shortfall_uses_exact_source_values():
    snapshot = bundle()
    snapshot.financial["upcoming_obligations"] = [{
        "kind": "supplier", "due_date": (date.today() + timedelta(days=7)).isoformat(),
        "amount_mmk": "400000", "reference_id": "private-purchase",
    }]
    result = await AnalysisService(Provider(snapshot), Client()).analyze("biz-a")
    due = next(item for item in result.insights if item.id == "supplier-shortfall")
    assert [(item.metric, item.value) for item in due.evidence] == [
        ("cash_balance_mmk", 100000), ("supplier_due_30d_mmk", 400000)
    ]
    assert "private-purchase" not in str(build_context(snapshot))


@pytest.mark.anyio
async def test_stale_import_during_generation_is_marked_outdated():
    provider = Provider(bundle())

    class ImportingClient(Client):
        async def explain(self, insights, context):
            provider.current_version += 1
            return await super().explain(insights, context)

    result = await AnalysisService(provider, ImportingClient()).analyze("biz-a")
    assert result.outdated is True


@pytest.mark.anyio
async def test_concurrent_clicks_share_one_model_call():
    client = Client()
    service = AnalysisService(Provider(bundle()), client)
    first, second = await asyncio.gather(service.analyze("biz-a"), service.analyze("biz-a"))
    assert first.generated_at == second.generated_at
    assert client.calls == 1


@pytest.mark.anyio
async def test_model_quota_falls_back_to_rules(monkeypatch):
    monkeypatch.setattr("app.features.ai.service.MAX_MODEL_CALLS_PER_HOUR", 0)
    client = Client()
    result = await AnalysisService(Provider(bundle()), client).analyze("biz-a")
    assert result.status == "rules_only"
    assert client.calls == 0
    assert "limit" in result.warnings[-1]


def test_optional_adapter_requires_matching_business_and_import(monkeypatch):
    seen = []
    def fake_import(_name):
        return SimpleNamespace(get_ai_snapshot=lambda business_id, sessions: (
            seen.append((business_id, sessions)) or
            {"business_id": business_id, "source_version": 2}
        ))
    monkeypatch.setattr("app.features.ai.snapshot_provider.importlib.import_module", fake_import)
    assert _optional_snapshot("any", "biz-a", 3, "sessions") is None
    assert _optional_snapshot("any", "biz-a", 2, "sessions")["source_version"] == 2
    assert seen == [("biz-a", "sessions"), ("biz-a", "sessions")]


@pytest.mark.anyio
async def test_unverified_overdue_claim_reverts_to_rules():
    class InventingClient(Client):
        async def explain(self, insights, context):
            result = await super().explain(insights, context)
            result["items"][0]["explanation"] = "Every customer balance is overdue."
            return result
    result = await AnalysisService(Provider(bundle()), InventingClient()).analyze("biz-a")
    assert result.status == "rules_only"
