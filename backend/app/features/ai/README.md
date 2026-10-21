# P4 AI Business Analyzer handoff

The backend exports `app.features.ai.router.router`. P5's current `app/main.py` discovers it automatically and applies `authorize_business`. The frontend exports `AIAnalyzerPage` from `src/features/ai-analyzer/AIAnalyzerPage.tsx`; P5 should replace the current `/ai` preview with that page.

## Endpoints

- `POST /api/v1/ai/analyze?business_id=...` builds a new analysis, reusing an identical snapshot for 10 minutes.
- `GET /api/v1/ai/insights/latest?business_id=...` returns the last report for the business or JSON `null`. `outdated` becomes true when the business import version changes.

Both require authenticated business membership. The backend reads P1, P2, and P3 service snapshots and does not write workbook or financial tables.

## Module adapters

P1 is read through `PlatformFinancialService.financial_snapshot` when its branch is integrated. P2 and P3 should each export `app.features.<module>.ai_adapter.get_ai_snapshot(business_id, sessions)`, where `sessions` is P5's SQLAlchemy session factory. The adapter must return a plain dict or Pydantic model with `business_id`, `source_version`, `synthetic`, `as_of`, and the corresponding aggregate fields in `SHARED_CONTRACTS.md`. P4 ignores P2/P3 results with a different import version. Adapter implementations must use read-only, business-scoped services, not raw transaction tables. P2/P3 branches were not on the remote when this branch was built.

The P1 branch currently marks its platform snapshots `synthetic=False` by default. P5/P1 should mark verified seeded demo data `synthetic=True` if the OpenAI step is wanted in the demo. Otherwise the safe rules-only result appears.

## Environment and privacy

- `OPENAI_API_KEY`: server-side key. No browser key.
- `OPENAI_MODEL`: optional; defaults to `gpt-5-mini`.
- `AI_ALLOW_REAL_DATA`: defaults to false. Enable only after the product discloses provider use and obtains the required consent. The server sends only allowlisted aggregate metrics and deterministic flags, never names, invoice rows, tokens, or workbook contents.

The OpenAI step uses the Responses API with structured output and `store=false`. It can change wording only. Category, priority, evidence, and values remain deterministic. Responses with digits or unsupported claims fall back to rules-only. Timeouts and missing keys also show rules-only results.

The cache is process-local and resets on backend restart; multi-worker deployments need a shared cache if persistent latest reports or global quotas are required. This MVP keeps results out of business transaction tables.
Concurrent Analyze clicks for one business are serialized. At most ten provider calls per business are attempted per hour in each backend process.

## Verification

`cd backend && python -m pytest app/features/ai/tests/test_analysis.py -q`
