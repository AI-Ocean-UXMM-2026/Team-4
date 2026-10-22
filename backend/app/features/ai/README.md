# P4 AI Business Analyzer handoff

The backend exports `app.features.ai.router.router`. P5's `app/main.py` discovers it automatically and applies `authorize_business`. The `/ai` route renders `AIAnalyzerPage` from `src/features/ai-analyzer/AIAnalyzerPage.tsx`.

## Endpoints

- `POST /api/v1/ai/analyze?business_id=...` builds a new analysis, reusing an identical snapshot for 10 minutes.
- `GET /api/v1/ai/insights/latest?business_id=...` returns the last report for the business or JSON `null`. `outdated` becomes true when the business import version changes.

Both require authenticated business membership. The backend reads P1, P2, and P3 service snapshots and does not write workbook or financial tables.

## Module adapters

P1 is read through `PlatformFinancialService.financial_snapshot`. P2 and P3 export `app.features.<module>.ai_adapter.get_ai_snapshot(business_id, sessions)`. The adapters return business-scoped aggregates with the current `source_version`; P4 ignores an adapter result from another import version. Workbook v1 does not include supplier lead times or loan schedule terms, so those AI comparisons remain unavailable.

P4 marks data synthetic only when the latest successful import has the exact SHA-256 hash of one of this repository's bundled seed workbooks for its matching demo business. Other imported data remains rules-only by default.

## Environment and privacy

- `OPENAI_API_KEY`: server-side key. No browser key.
- `OPENAI_MODEL`: optional; defaults to `gpt-5-mini`.
- `AI_ALLOW_REAL_DATA`: defaults to false. Enable only after the product discloses provider use and obtains the required consent. The server sends only allowlisted aggregate metrics and deterministic flags, never names, invoice rows, tokens, or workbook contents.

The OpenAI step uses the Responses API with structured output and `store=false`. It can change wording only. Category, priority, evidence, and values remain deterministic. Responses with digits or unsupported claims fall back to rules-only. Timeouts and missing keys also show rules-only results.

The latest report is persisted in `ai_analysis_reports` with its business and source version, so it survives restarts and is consistent across workers. The ten-minute reuse cache and hourly provider-call quota remain process-local; multi-worker deployments should move those controls to a shared store. Reports stay separate from business transaction tables.
Concurrent Analyze clicks for one business are serialized. At most ten provider calls per business are attempted per hour in each backend process.

## Verification

`cd backend && python -m pytest app/features/ai/tests/test_analysis.py -q`
