# Person 1 — connected Financial Health

Person 1 is connected to the current P5 platform on branch p1-financial.
The financial homepage now uses ConnectedFinancialPage instead of the prototype
Dashboard. Other modules retain their current views. The shared routing change
is confined to src/app/routes.tsx; auth, DB schema, workbook format, importer,
shared contracts and deployment code are unchanged.

## Runtime integration

P5's existing module discovery mounts app.features.financial.router. Its default
dependencies now use the existing authorize_business membership/auth check and
request.app.state.sessions. The repository reads business-scoped typed PROJECTIONS
inside a consistent transaction with the same business-row locking used by P5.
It never parses ImportedRow payloads, writes financial records, or substitutes
empty collections for database errors.

Endpoints:
- GET /api/v1/financial/summary?business_id=...&start=YYYY-MM-DD&end=YYYY-MM-DD
- GET /api/v1/financial/trends?business_id=...&end=YYYY-MM-DD&months=3
- GET /api/v1/financial/obligations?business_id=...&as_at=YYYY-MM-DD&before=YYYY-MM-DD

Date boundaries are inclusive. Month trends label their exact boundaries and the
current partial month. The Financial Health homepage is `/`, matching P5's
navigation. Data Source remains `/data-source`; no second upload UI was added.

ConnectedFinancialPage reads the active business and current source_version from
the existing platform provider/snapshot query. It calls financial endpoints using
the shared authenticated API client. Existing import invalidation refreshes that
snapshot query, immediately hides prior figures, and refetches financial data.
The hook checks business, reporting period, batch ID and source version before
showing results; mixed import versions are rejected. Refresh also refetches the
shared source version. It shows explicit empty/error/loading states.

## Exact money and supported calculations

Current workbook v1 supplies decimal strings and fractional quantities. The new
platform calculator uses Python Decimal and returns money as exact decimal
strings; the frontend formats those strings without floating-point rounding.
The original whole-MMK calculations remain available for richer original-spec
records and their regression tests. Production uses PlatformFinancialService,
not an invented mapping from the new workbook to the old integer models.

Implemented from normalized actual records:
- Period revenue = sold quantity times recorded selling price.
- Receivables = sale total minus initial cash_received_mmk and later receipts.
- Payables = purchase total minus initial cash_paid_mmk and later payments.
- Recognized operating expenses and cash-paid loan interest for the period.
- Cash includes recorded initial settlements, later receipts/payments, loan
  disbursements, principal/interest payments and cash adjustments, when expense
  settlement information is sufficient (see limitations below).
- Opening balance is immediately before opening_date; that day's movements are
  included. Earlier receipts/invoices remain included in outstanding balances.
- Last successful import provenance and monotonic source version accompany the
  metrics. Failed imports and unchanged re-uploads do not fabricate new figures.

## Current workbook limitations (displayed in the UI)

The integration works with the existing schema without migrations. It does not
supply source facts that the workbook lacks:

1. Sales have no historical unit_cost_at_sale_mmk. If period sales exist, COGS,
   gross/operating profit and profit before tax are null. Current product cost is
   never substituted for historical sold cost. A validated period with no sales
   has zero COGS.
2. Expenses have no payment status/date. If recorded expenses exist on or before
   the balance date, actual cash is null and unpaid-expense obligations cannot
   be established. Expenses are still reported as recognized costs on their
   recorded date. They are not silently treated as paid.
3. Supplier due dates are optional. Existing workbooks remain valid; when a
   recorded purchase due_date exists, its outstanding amount is classified using
   the selected reporting end date. Missing dates remain unavailable and are not
   guessed. Loan installment schedules are not part of the workbook-backed
   platform contract, so loan principal is reported separately and never treated
   as an installment due. The legacy calculation interface can consume validated
   recorded schedules, but the authenticated workbook API does not currently
   persist or supply them. Expense due lists also remain incomplete in that API.
4. Interest is cash-paid interest, not accrued interest. Taxes and depreciation
   are excluded. This is a simplified operational report.
5. Only an exact hash match for a bundled seed workbook and its matching seeded
   business is labeled synthetic. Ordinary uploads and edited workbooks are not
   mislabeled; the connected page displays the synthetic-data notice when this
   exact match is present.

The shared workbook contract now accepts an optional supplier purchase due_date.
PostgreSQL deployments must apply `database/migrations/007_supplier_due_dates.sql`
before importing that field. Local SQLite schema setup derives optional columns
from the shared contract. A reliable loan schedule still needs an agreed source
schema before it can appear in the authenticated workbook API.

Manual supplier due-date changes use the same persisted purchase projection and
increment the business source version. Apply `database/migrations/018_purchase_due_date_overrides.sql`
after the earlier migrations before enabling manual edits on PostgreSQL. The
override record retains the last workbook date and a dated actor/action history;
`row_revisions` retains prior purchase payloads. An unchanged workbook date keeps
the manual correction. If a later workbook supplies a different date, import
stops with `DUE_DATE_CONFLICT` until the owner chooses **Keep manual dates** or
**Use workbook dates**. Keeping manual dates makes the override authoritative
for that purchase until another explicit resolution; accepting workbook dates
makes the workbook value authoritative again. Normal uploads still retain omitted
rows, while complete replacement deactivates an omitted purchase and its override.

## Validation

From repository root after installing backend requirements:

    python -m pytest backend/app/features/financial/tests backend/app/integrations/excel/tests -q
    npx tsc --noEmit
    npm test

Windows local validation used an ignored portable test runner because Application
Control blocks downloaded native build binaries. The same backend package version
was built without optional native extensions for SQLite integration tests.

Verified: 108 backend tests passed; one live Supabase RLS test skipped because it
requires external configuration. All 53 frontend tests passed; TypeScript passed.
This includes actual Excel upload -> SQL projections -> financial API, unchanged
re-upload idempotency, same-ID expense update, partial initial settlement and
fractional money, cross-business/anonymous rejection, version invalidation and
precise decimal display. Backend auth tests use mocked provider responses and a
real signed test JWT; no live account was created or messaged.

The normal production build/browser auth flow was not run on this machine due
to its native build-binary restriction. No deployment or live data connection
has been claimed. Keep the integration on its branch for P5 review before merging.

## Recovery provenance

Original P1 source recovered from GitHub Desktop saved changes
5c40cd0de508688b9d358618b60e20e04446356d and saved in recovery commit afa1133.
Saved changes and main were preserved. Source paths follow the current platform:
backend/app/features/financial and src/features/financial.
