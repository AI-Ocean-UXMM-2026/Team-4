# Existing loan import

Each Loans row describes one real loan agreement: loan_id, lender, bank_id,
loan_product_id, loan_product, annual_rate_pct, term_months, first_payment_date,
payment_frequency, loan_type, principal_mmk and date (disbursement).
Use the signed agreement's annual rate, not a rate range from the bank guide.
For example, enter 12 for 12% annually. Enter 0 for interest-free; blank is unknown.
Bank/product IDs and names must match shared/contracts/loan-products.json. This
catalog defines supported product identities, not live rates or eligibility.

The seven new columns are optional for older workbooks. When supplying any of
them, supply all seven. Term must be
a whole number from 1 to 1200 months. Imported terms are retained in the versioned
payload and read by Credit Hub, without modifying the older projection tables.

Outstanding loans may belong to multiple banks. KBZ and Yoma products can use the
structured product catalog. For other banks, analysis uses only the loan and
repayment details entered by the user and must be checked against the signed loan
agreement or bank statement. Use a consistent lender name; KBZ/KBZ Bank and
Yoma/Yoma Bank are recognized aliases.

The bank guide is informational browsing, not an application or borrowing action.
Only imported loan agreements appear in Existing loans. A product's published
rate must never overwrite the agreed rate of an existing loan.

Schedule estimates currently support reducing-balance equal monthly installments,
with the first payment exactly one calendar month after disbursement. Dates are
anchored to the explicit first payment day, clipped at month end. Irregular first
periods and weekly/quarterly arrangements are stored but not estimated. These need
the lender's day-count/accrual rules or schedule. Fees, grace periods and variable
rates are outside this estimator. Compare a real lender statement before relying
on an estimate. Missing terms on older records show a request to complete them.

Download template in Data Source, keep the same business/loan/payment IDs when
updating, fill the agreement terms, save, and import. Review import errors by row.
Bank/product choices and instructions are included in ReadMe and in the upload UI.
Do not import the synthetic sample into a real business.

Authoring: tools/workbook/upgrade-credit.mjs updates the template and produces a
clearly labeled synthetic sample. Run tools/workbook/check_credit_import.py with
the backend Python runtime to verify both and test import in an isolated database.
