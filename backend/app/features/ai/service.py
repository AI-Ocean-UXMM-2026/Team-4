"""Versioned, read-only analysis with bounded in-process reuse."""
import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone

import httpx

from .context_builder import build_context
from .deterministic_flags import flags
from .llm_client import AIWordingClient
from .parser import grounded_insights
from .schemas import AIAnalysis, SnapshotBundle

CACHE_TTL_SECONDS = 600
MAX_MODEL_CALLS_PER_HOUR = 10
_cache: dict[str, tuple[float, AIAnalysis]] = {}
_latest: dict[str, AIAnalysis] = {}
_locks: dict[str, asyncio.Lock] = {}
_call_times: dict[str, list[float]] = {}


class SourceVersionChanged(Exception):
    """A request's consent must apply to the import the user saw."""


def provider_failure_warning(error: Exception, provider_name: str = "OpenAI") -> str:
    if isinstance(error, httpx.TimeoutException):
        return f"{provider_name} timed out; rules-based findings are shown. Try Analyze Business again."
    if isinstance(error, ValueError):
        if str(error) == "AI response was not completed":
            return "AI response was incomplete; rules-based findings are shown. Try Analyze Business again."
        return "AI wording failed evidence validation; rules-based findings are shown. Try Analyze Business again."
    if isinstance(error, httpx.HTTPStatusError):
        try:
            code = (error.response.json().get("error") or {}).get("code")
        except (ValueError, AttributeError):
            code = None
        if code == "credit_balance_exhausted":
            return f"{provider_name} API credits are exhausted; rules-based findings are shown."
        if error.response.status_code == 402:
            return f"{provider_name} account has insufficient credits; rules-based findings are shown."
        if error.response.status_code == 401:
            return f"{provider_name} rejected the backend API key; rules-based findings are shown."
        if code in {"organization_spend_limit_exceeded", "project_spend_limit_exceeded",
                    "organization_usage_limit_exceeded"}:
            return f"{provider_name} account or project usage limit was reached; rules-based findings are shown."
        if error.response.status_code == 429:
            return f"{provider_name} rate limit was reached; rules-based findings are shown."
    return "AI wording was unavailable or failed evidence validation; rules-based findings are shown."


class AnalysisService:
    def __init__(self, provider, client=None):
        self.provider = provider
        self.client = client or AIWordingClient()

    def latest(self, business_id: str) -> AIAnalysis | None:
        version = self.provider.version(business_id)
        load_persisted = getattr(self.provider, "latest_analysis", None)
        item = load_persisted(business_id) if callable(load_persisted) else None
        item = item or _latest.get(business_id)
        if item is None:
            return None
        return item.model_copy(update={"outdated": item.source_version != version})

    async def analyze(self, business_id: str, *, expected_source_version: int | None = None,
                      provider_consent: bool = False) -> AIAnalysis:
        # Serialize concurrent clicks for the same business before checking cache/quota.
        async with _locks.setdefault(business_id, asyncio.Lock()):
            return await self._analyze_locked(business_id, expected_source_version, provider_consent)

    async def _analyze_locked(self, business_id: str, expected_source_version: int | None,
                              provider_consent: bool) -> AIAnalysis:
        bundle: SnapshotBundle = self.provider.load(business_id)
        if bundle.business_id != business_id:
            raise PermissionError("Cross-business analysis input")
        if expected_source_version is not None and bundle.source_version != expected_source_version:
            raise SourceVersionChanged()
        if provider_consent and expected_source_version is None:
            raise ValueError("AI provider consent must name the current import version")
        context = build_context(bundle)
        selected = flags(context)
        digest = hashlib.sha256(json.dumps(bundle.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
        client_key = hashlib.sha256(self.client.api_key.encode()).hexdigest()[:12]
        cache_key = (
            f"{business_id}:{bundle.source_version}:{bundle.import_batch_id}:{digest}:"
            f"{getattr(self.client, 'provider', 'openai')}:{getattr(self.client, 'model', '')}:"
            f"{client_key}:{provider_consent}"
        )
        cached = _cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1].model_copy(update={"outdated": self.provider.version(business_id) != bundle.source_version})
        status = "insufficient_data" if not selected else "rules_only"
        warnings = list(context["warnings"])
        eligible_for_model = (
            bool(selected) and
            provider_consent and
            bool(self.client.api_key)
        )
        now = time.monotonic()
        calls = [stamp for stamp in _call_times.get(business_id, []) if now - stamp < 3600]
        _call_times[business_id] = calls
        provider_failed = False
        if eligible_for_model and len(calls) >= MAX_MODEL_CALLS_PER_HOUR:
            warnings.append("AI hourly call limit reached; rules-based findings are shown.")
        elif eligible_for_model:
            calls.append(now)
            try:
                wording = await self.client.explain(selected, context)
                try:
                    selected = grounded_insights(wording, selected)
                except ValueError:
                    if len(calls) >= MAX_MODEL_CALLS_PER_HOUR:
                        raise
                    calls.append(time.monotonic())
                    wording = await self.client.explain(selected, {**context, "wording_retry": True})
                    selected = grounded_insights(wording, selected)
                status = "completed"
            except Exception as error:
                provider_failed = True
                # No provider payload, key, or financial details are logged.
                provider_name = "OpenRouter" if getattr(self.client, "provider", "openai") == "openrouter" else "OpenAI"
                warnings.append(provider_failure_warning(error, provider_name))
        elif selected and not provider_consent:
            warnings.append("External AI analysis was not selected; rules-based findings are shown.")
        elif selected and not self.client.api_key:
            warnings.append("AI provider is not configured; rules-based findings are shown.")
        result = AIAnalysis(
            business_id=business_id, status=status, data_as_of=context["data_as_of"],
            source_version=bundle.source_version, import_batch_id=bundle.import_batch_id,
            generated_at=datetime.now(timezone.utc), insights=selected, warnings=warnings,
            disclaimer="Decision support only; synthetic demo data." if context["synthetic"]
                       else "Decision support only; verify source records before acting.",
            outdated=self.provider.version(business_id) != bundle.source_version,
        )
        if not provider_failed:
            _cache[cache_key] = (time.monotonic(), result)
        _latest[business_id] = result
        save_persisted = getattr(self.provider, "save_analysis", None)
        if callable(save_persisted):
            save_persisted(result)
        return result
