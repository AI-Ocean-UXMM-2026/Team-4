# P4 AI Business Analyzer handoff

The backend exports `app.features.ai.router.router`. P5's `app/main.py` discovers it automatically and applies `authorize_business`. The `/ai` route renders `AIAnalyzerPage` from `src/features/ai-analyzer/AIAnalyzerPage.tsx`.

## Endpoints

- `POST /api/v1/ai/analyze?business_id=...` builds a new analysis, reusing an identical snapshot and consent choice for 10 minutes. Send JSON `{ "source_version": 2, "provider_consent": true }` after the user explicitly opts in to external AI for the current import. Send `provider_consent: false` for rules-only analysis. A version mismatch returns 409.
- `GET /api/v1/ai/insights/latest?business_id=...` returns the last report for the business or JSON `null`. `outdated` becomes true when the business import version changes.

Both require authenticated business membership. The backend reads P1, P2, and P3 service snapshots and does not write workbook or financial tables.

## Module adapters

P1 is read through `PlatformFinancialService.financial_snapshot`. P2 and P3 export `app.features.<module>.ai_adapter.get_ai_snapshot(business_id, sessions)`. The adapters return business-scoped aggregates with the current `source_version`; P4 ignores an adapter result from another import version. Workbook v1 does not include supplier lead times or loan schedule terms, so those AI comparisons remain unavailable.

P4 marks data synthetic only when the latest successful import has the exact SHA-256 hash of one of this repository's bundled seed workbooks for its matching demo business, or matches a local demo business ID and import hash explicitly pinned in backend environment variables. Synthetic labeling affects the disclaimer, not eligibility for AI wording. Any uploaded business workbook can use AI wording after explicit consent for that import version.

## Environment and privacy

- `AI_PROVIDER`: `openai` (default) or `openrouter`.
- `OPENAI_API_KEY`: server-side OpenAI key when using `openai`. No browser key.
- `OPENAI_MODEL`: optional; defaults to `gpt-5-mini`.
- `OPENROUTER_API_KEY`: server-side OpenRouter key when using `openrouter`.
- `OPENROUTER_MODEL`: optional; defaults to `openai/gpt-5-mini`. Choose a model/provider route that supports structured output.
- `AI_SYNTHETIC_DEMO_BUSINESS_ID` and `AI_SYNTHETIC_DEMO_IMPORT_SHA256`: optional local demo pin. Use the exact business ID and SHA-256 hash recorded for a successful synthetic workbook import. A new workbook import needs a new pin only to display the synthetic demo disclaimer.

The AI Analyzer page has one Analyze with AI action with a nearby disclosure; selecting it gives consent for the current import. The server accepts an AI request only when the submitted import version still matches the loaded snapshot. It sends only allowlisted aggregate metrics and deterministic findings, never names, invoice rows, tokens, or workbook contents. The API can still run rules-only analysis without consent, and provider failures fall back to verified findings.

The wording step uses the selected provider's Responses API with structured output and `store=false`. OpenRouter requests require a route that supports all parameters. It can change wording only. Category, priority, evidence, and values remain deterministic. Responses with digits or unsupported claims fall back to rules-only. Timeouts and missing keys also show rules-only results. Restart the backend after changing provider settings.

The latest report is persisted in `ai_analysis_reports` with its business and source version, so it survives restarts and is consistent across workers. The ten-minute reuse cache and hourly provider-call quota remain process-local; multi-worker deployments should move those controls to a shared store. Reports stay separate from business transaction tables.
Concurrent Analyze clicks for one business are serialized. At most ten provider calls per business are attempted per hour in each backend process.

## Verification

`cd backend && python -m pytest app/features/ai/tests/test_analysis.py -q`
