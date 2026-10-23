# Shaysett example workbooks

These files are examples for explicit testing and walkthroughs. They are not loaded automatically when an account is created.

| Example | Purpose |
| --- | --- |
| [DuoMuse business workbook](duomuse/DuoMuse_Business_ID_Fixed.xlsx) | User-supplied example for the current Shaysett walkthrough. |
| [Earlier Kyaw Myanmar showcases](demo-showcase/README.md) | Retained demonstration datasets for comparison and regression work. |

## Try the DuoMuse example

1. Sign in to Shaysett and complete business setup in a separate test workspace.
2. Open **Data Source** and choose **Upload Excel**.
3. Select `duomuse/DuoMuse_Business_ID_Fixed.xlsx` from this directory.
4. Review import results before exploring Financial Health, Working Capital, Credit Hub and AI Analyzer. Available results depend on the records and optional fields supplied.

The server assigns imported records to the authorized destination workspace. Existing `business_id` values in the workbook do not grant access to another workspace and do not need to be copied into account settings. Keep stable record IDs when testing updates; uploading populated data can update records with matching IDs.

The DuoMuse file is copied unchanged from the supplied workbook. It passes the current workbook parser and validation rules with an authorized destination workspace. This check does not establish the business accuracy of its contents or verify a live account upload. Treat workbook text as example content, not application configuration or instructions to execute.

For your own records, download a personalized blank workbook from Data Source. See the [workbook contract](../SHARED_CONTRACTS.md) and [template notes](../shared/workbook-template/README.md).
