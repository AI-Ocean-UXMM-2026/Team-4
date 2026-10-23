# Shaysett shared contracts v1

P5's workbook and authentication platform now integrates the P1–P4 feature branches. Feature owners should review financial interpretation before a release. The frontend stays at `src/` (do not create a second `frontend/` app).

The machine-readable source of workbook fields is [workbook-schema.json](shared/contracts/workbook-schema.json). Frontend response types are [contracts.ts](src/lib/contracts.ts). The API schema is available at `/docs` and `/openapi.json` on the backend.

## Workbook format

`.xlsx`, maximum 5 MiB compressed, 40 MiB expanded, 10,000 rows per sheet and 30,000 input rows overall. Header row is Excel row 1, data begins on row 2. Required headers must exist; optional fields may be omitted or left blank. Keep empty required sheets with their headers. CashAdjustments is optional; ReadMe is ignored. Other sheets are ignored with a warning. Formula inputs, external workbook links, macros, duplicate headers and duplicate stable IDs are rejected.

Every input row has one `business_id`, identical to Settings and the authorized business in the request. IDs are text, case-sensitive, up to 80 characters, with letters, numbers, underscores or hyphens. New records receive new IDs; edits keep the existing ID. Required text cannot be blank (use a short description). Dates are Excel dates without times or ISO `YYYY-MM-DD`. Money is non-negative MMK with at most 2 decimals; quantities have at most 3 decimals. Positive fields cannot be zero. Quantity times unit price must yield exact hundredths of MMK. The parser uses Decimal, never floats, for validation.

| Sheet | Stable ID | Fields after ID (in template order) |
| --- | --- | --- |
| Settings | business_id | business_name, currency (`MMK`), opening_date, opening_cash_mmk |
| Products | product_id | business_id, name, opening_stock, unit_cost_mmk |
| Sales | sale_id | business_id, date, product_id, quantity, unit_price_mmk, payment_type, cash_received_mmk, unit_cost_at_sale_mmk (optional), cogs_mmk (optional) |
| CustomerReceipts | receipt_id | business_id, date, sale_id, amount_mmk |
| Purchases | purchase_id | business_id, date, product_id, quantity, unit_cost_mmk, payment_type, cash_paid_mmk; optional due_date |
| SupplierPayments | payment_id | business_id, date, purchase_id, amount_mmk |
| Expenses | expense_id | business_id, date, category (free-text label), amount_mmk, description, payment_status (optional), paid_date (optional), amount_paid_mmk (optional) |
| Loans | loan_id | business_id, date, lender, loan_type (source label), principal_mmk |
| LoanPayments | payment_id | business_id, date, loan_id, principal_mmk, interest_mmk |
| CashAdjustments | adjustment_id | business_id, date, direction, amount_mmk, reason |

## Business interpretation for review

- Opening cash and inventory are balances immediately before `opening_date`. Transactions may not predate that date. Products.unit_cost_mmk is opening inventory's reference cost; the prototype adapter uses it for a simple stock display, not FIFO/weighted-average accounting.
- Sale/purchase totals equal quantity × unit price/cost. `cash` requires full initial settlement; `credit` permits zero or partial initial settlement. Later receipts/payments are separate stable rows and cannot exceed the remaining total, even cumulatively. Payment dates cannot predate their parent.
- Incoming `partial` payment labels are stored as `credit` with the recorded initial cash settlement; expense categories and loan type labels are preserved as text. A loan purpose label does not provide repayment terms or establish a repayment model.
- Inventory purchases precede sales on the same calendar day; IDs order same-type events. This is a daily ledger, not an intraday stock ledger. Accepted stock cannot go negative at any event.
- Loans are new disbursements on their recorded dates, included in cash inflow. `loan_type` is preserved as a source label and does not establish repayment terms. Only a supported repayment model with explicit rate and term may produce a schedule; principal and interest payments remain actual facts. Cumulative principal repayments cannot exceed disbursed principal. **Pre-period opening loans and multi-line sale/purchase documents are not supported in v1**; feature owners must agree on extensions rather than silently changing interpretation.
- Expense categories are descriptive text labels. LoanPayments must have nonzero principal or interest. CashAdjustments direction: `in` or `out`; these are cash movements, not sales/profit.
- Sales may include historical `unit_cost_at_sale_mmk` and/or row-total `cogs_mmk`; if both are supplied, COGS must equal quantity times historical unit cost. Financial reports use supplied row COGS once, or calculate it from the historical unit cost; they never substitute today's product cost. Expenses may include `payment_status` (`paid`, `partial`, `unpaid`), `paid_date` and `amount_paid_mmk`. Paid amounts are dated cash movements, separate from the expense recognition amount. Old workbooks may omit these extension columns, in which case dependent totals remain unavailable.
- One canonical workbook source per business. Linking OneDrive uses that same source as upload. Multi-workbook merging is deliberately unsupported. The natural ingestion key is `(business_id, source_id, sheet_name, row_id)` with a database uniqueness constraint.
- Input hash/eTag and import batch identify source changes. A repeated current hash is a no-op; changed rows replace their fact once and save the old payload, batch and revision. All fact/projection changes and the successful audit commit together.
- Rows missing from a valid file remain active and produce warnings. Required-sheet omission is an error. The combined incoming plus retained history must also validate. No deletion policy is implied. Switching to a radically different workbook requires reconciliation by owners.
- Imports serialize at the business row in the database. Graph captures business version plus link identity and rejects an obsolete in-flight download. A manual import clears the accepted cloud eTag so the next Sync Now must reconsider cloud content.

## API contract

Business-scoped endpoints require `Authorization: Bearer <Supabase JWT>` and query parameter `business_id`. Server-verified identity, confirmed email, completed profile/business setup and membership are checked on every request. The OAuth callback instead consumes a browser-bound, one-use expiring server state carrying the authorized business/user. Browser state and IDs never establish authorization.

| Method | Path | Result |
| --- | --- | --- |
| POST | /api/v1/auth/register | Validated account/business details forwarded to Supabase; no local membership until verified |
| POST | /api/v1/auth/resend-verification | Provider resend (`type=signup`); neutral accepted result, explicit 429/503 failures |
| POST | /api/v1/auth/forgot-password | Generic provider email recovery with fixed trusted callback |
| GET | /api/v1/auth/me | Server-verified profile, onboarding state and validated business draft |
| GET | /api/v1/auth/profile | Authenticated user's editable profile and owned business, as `{user,business}` |
| POST | /api/v1/auth/profile | Save `{full_name,business?:BusinessInput,avatar_data_url?:string\|null}` and return `{user,business}` |
| POST | /api/v1/auth/onboarding | Atomic idempotent empty-workspace creation for verified identity |
| GET | /api/v1/config | Public feature/auth capabilities, no secrets |
| GET | /api/v1/businesses | Current user's business memberships |
| POST | /api/v1/data/upload | Multipart `file`; atomic import result |
| GET | /api/v1/data/template | Personalized empty input template |
| GET | /api/v1/data/snapshot | Typed shared tables plus monotonically increasing source_version |
| GET | /api/v1/data/sync-status | Link status, real timestamps, last ten audits, upload limit |
| GET | /api/v1/auth/microsoft/connect | Delegated OAuth URL and HTTP-only state cookie |
| GET | /api/v1/auth/microsoft/callback | OAuth completion; returns to Data Source |
| GET | /api/v1/data/files | Authorized OneDrive folders and .xlsx files (`folder_id` optional) |
| POST / DELETE | /api/v1/data/link | Link `{drive_id,item_id}` / erase saved authorization and unlink |
| POST | /api/v1/data/sync-now | Cloud eTag check and shared importer |

Profile endpoints require a server-verified Supabase identity. The server derives the user's owned business from `owner_id`; a client-supplied business ID cannot select another business. Email addresses and user/business IDs are read-only. `BusinessInput` uses the existing business details accepted at onboarding. A user without an owned business may save their name alone; profile editing does not create a business. Updating profile or business contact details does not change imported workbook settings, ledger records, or the workbook `source_version`.

`user.avatar_data_url` is the current user's optional private profile photo, or `null` for the initials fallback. To replace it, include `avatar_data_url` as a base64 data URL for a JPG, PNG or WebP image up to 2 MiB. The server verifies the image, applies its orientation, crops/resizes it to a 256px square, strips metadata and stores a JPEG in the profile database. Omit the field to preserve the photo; send `null` to remove it. Photo and profile edits save atomically. SQLite upgrades add the nullable field at startup; PostgreSQL deployments must apply `009_profile_photos.sql` before running this version.

Import result: `{import_batch_id,status,source_version,row_counts:{inserted,updated,unchanged},errors,warnings,created_at}`. Status is `success`, `up_to_date` or `failed`. Validation errors return HTTP 400 with the failed import result in `error.details[0]`. Each issue has `{sheet,row,field,reason}`; row 0 refers to workbook-level or retained-history issues. eTag no-op responses may omit batch ID/timestamp. Monetary/quantity snapshot values are exact decimal **strings**, dates ISO strings, timestamps UTC with offsets.

In sync-status history, `source_version` reflects the current business snapshot; it is not a historical version number for each old batch. Historical facts are identified by batch ID and row revision metadata.

Errors: `{error:{code,message,details}}`. HTTP 400 invalid input; 401 session/reconnect; 403 business access; 404 missing resource; 409 source/import/save conflict; 429 throttle (Retry-After); 503 integration unavailable. Failed validation and known Graph failures are audited; unexpected database failures roll back without a partial success audit.

Auth email success bodies include `status` (`verification_required` for an accepted pending signup, otherwise neutral `check_email`), `message` and the known application `cooldown_seconds`. No response proves email delivery. Email throttles return 429 and pass through `Retry-After` only when the provider supplies it or the application has a measured deadline. Unknown retry timing has no header/countdown. Setup and availability errors return 503. `/api/v1/config` adds `auth_status: {ready, code, message}`, `auth_url` and the SHA-256 `auth_key_fingerprint` (public key only); browser/build mismatch also blocks auth submissions. Configuration preflight is independent of email delivery acceptance.

## Integration points for P1–P4

P5 mounts `router` exports from `app.features.financial.router`, `app.features.working_capital.router`, `app.features.credit.router`, `app.features.ai.router` when present. Authorization dependency is added centrally; owners must accept the same business_id query parameter and scope all repository queries. Missing modules are reported by `/health` and `/api/v1/config`; broken imports fail startup rather than being hidden.

Read typed SQL tables via `app.db.models.PROJECTIONS` or business-scoped snapshot API. Tables are `business_settings`, `products`, `sales`, `customer_receipts`, `purchases`, `supplier_payments`, `expenses`, `loans`, `loan_payments`, `cash_adjustments`. P1–P3 should not parse ImportedRow JSON. ImportedRow/RowRevision are ingestion audit storage.

Frontend composition uses `src/app/routes.tsx` and `src/routes/`. All four feature pages use the active business provider. Import success invalidates snapshot/status/business, credit and AI query keys; Working Capital refetches when the business source version changes. AI analysis retains its source version and shows stale state until an explicit rerun. P4 upstream data access remains read-only.

The P1–P4 branches were merged on the integration branch. The shared workbook v1 schema accepts optional historical sale-cost and expense-settlement columns plus an optional supplier purchase due_date while remaining compatible with earlier workbooks. Loan installment schedules remain unavailable unless a reliable schedule is explicitly supplied; outstanding principal is reported separately and is not treated as due. Missing loan terms, supplier due dates, stock lead times and historical cash inputs are reported as unavailable; no accounting profit or borrowing eligibility is inferred from incomplete records.
