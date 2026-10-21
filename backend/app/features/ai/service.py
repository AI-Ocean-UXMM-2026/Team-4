"""Versioned, read-only analysis with bounded in-process reuse."""
import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone

from .context_builder import build_context
from .deterministic_flags import flags
from .llm_client import OpenAIWordingClient
from .parser import grounded_insights
from .schemas import AIAnalysis, SnapshotBundle

CACHE_TTL_SECONDS = 600
MAX_MODEL_CALLS_PER_HOUR = 10
_cache: dict[str, tuple[float, AIAnalysis]] = {}
_latest: dict[str, AIAnalysis] = {}
_locks: dict[str, asyncio.Lock] = {}
_call_times: dict[str, list[float]] = {}


class AnalysisService:
    def __init__(self, provider, client=None):
        self.provider = provider
        self.client = client or OpenAIWordingClient()

    def latest(self, business_id: str) -> AIAnalysis | None:
        version = self.provider.version(business_id)
        item = _latest.get(business_id)
        if item is None:
            return None
        return item.model_copy(update={"outdated": item.source_version != version})

    async def analyze(self, business_id: str) -> AIAnalysis:
        # Serialize concurrent clicks for the same business before checking cache/quota.
        async with _locks.setdefault(business_id, asyncio.Lock()):
            return await self._analyze_locked(business_id)

    async def _analyze_locked(self, business_id: str) -> AIAnalysis:
        bundle: SnapshotBundle = self.provider.load(business_id)
        if bundle.business_id != business_id:
            raise PermissionError("Cross-business analysis input")
        context = build_context(bundle)
        selected = flags(context)
        digest = hashlib.sha256(json.dumps(bundle.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
        cache_key = (
            f"{business_id}:{bundle.source_version}:{bundle.import_batch_id}:{digest}:"
            f"{bool(self.client.api_key)}:{getattr(self.client, 'allow_real_data', False)}"
        )
        cached = _cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1].model_copy(update={"outdated": self.provider.version(business_id) != bundle.source_version})
        status = "insufficient_data" if not selected else "rules_only"
        warnings = list(context["warnings"])
        eligible_for_model = (
            bool(selected) and
            (context["synthetic"] or getattr(self.client, "allow_real_data", False)) and
            bool(self.client.api_key)
        )
        now = time.monotonic()
        calls = [stamp for stamp in _call_times.get(business_id, []) if now - stamp < 3600]
        _call_times[business_id] = calls
        if eligible_for_model and len(calls) >= MAX_MODEL_CALLS_PER_HOUR:
            warnings.append("AI hourly call limit reached; rules-based findings are shown.")
        elif eligible_for_model:
            calls.append(now)
            try:
                selected = grounded_insights(await self.client.explain(selected, context), selected)
                status = "completed"
            except Exception:
                # No provider payload, key, or financial details are logged.
                warnings.append("AI wording was unavailable or failed evidence validation; rules-based findings are shown.")
        elif selected and not context["synthetic"] and not getattr(self.client, "allow_real_data", False):
            warnings.append("AI provider was not called because this snapshot is not marked synthetic.")
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
        _cache[cache_key] = (time.monotonic(), result)
        _latest[business_id] = result
        return result
