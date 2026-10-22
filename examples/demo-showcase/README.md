# BizFlow demo: Kyaw Myanmar

Use `bizflow-showcase-kyaw-myanmar.xlsx` with the **Kyaw Myanmar** test business whose ID appears in the pin below. The workbook contains invented records from April through October 2026. It keeps the 96 rows from the earlier local demo workbook and adds one product and one April sale. When imported over that earlier workbook, it should report **2 inserted, 0 updated, 96 unchanged** and move the import version from 1 to 2. A fresh business has different import counts.

## Local setup

1. Run the backend from this commit.
2. In the backend's root `.env`, set the exact synthetic demo pin below. Leave your provider key in the backend environment; do not put it in any `VITE_` variable.

   ```env
   AI_SYNTHETIC_DEMO_BUSINESS_ID=57ef1d0f-5584-47e8-941f-09179bad7560
   AI_SYNTHETIC_DEMO_IMPORT_SHA256=8c3e7be97161ba99e36fa1b1e29a390e329d7e13a4c3bc472aa9c1cfdca73c38
   ```

3. Restart the backend after editing `.env`.
4. Sign in, select **Kyaw Myanmar**, open **Data Source**, and upload this workbook. Confirm that the import version increases and there are no validation errors. Do not edit or resave the workbook after using its SHA-256 pin; that changes its file hash.
5. Visit the feature pages, then click **Analyze Business** in **AI Analyzer**. The report should say **AI-assisted analysis** rather than **Rules-based analysis (AI unavailable)** when the selected provider is working.

## Walkthrough and expected results

| Feature | What to show |
| --- | --- |
| Data Source | One valid import, stable IDs, and a new source version. Re-uploading the identical file should be up to date without duplicate rows. |
| Financial Health | Sales history across seven months; September revenue MMK 2,079,000 versus October-to-date revenue MMK 1,323,000. Outstanding customer balances MMK 2,940,000 and supplier balances MMK 2,300,000. |
| Working Capital | Four products; `P-SPICE` has 75 packs on hand and no sales in the observed recent window. Use the simulators as labeled scenarios, not as recorded transactions. |
| Credit Hub | One recorded loan, MMK 1,400,000 principal outstanding, six actual repayment rows, and a record-preparation checklist. A future schedule needs the loan rate and term. |
| AI Analyzer | Five evidence-backed findings: receivables, supplier balances, stock without recent sales, missing loan terms, and data quality. Evidence values come from the current version of the Financial Health, Working Capital, and Credit Hub snapshots. |

The workbook v1 does not record whether expenses were paid, historical cost at sale, supplier due dates, stock lead times, or loan rate and term. The app correctly leaves exact cash, profit, purchasing budget, stockout timing, and loan schedule unavailable. The AI report should explain these limits rather than invent values.

This workbook is synthetic. Do not use its figures for a real lending or purchasing decision.

The file's `business_id` matches one local test account. For a different account, change `business_id` in Settings and every input row, validate the edited workbook, and use its new SHA-256 hash with that account's ID. The exact pin above applies only to the unmodified file.
