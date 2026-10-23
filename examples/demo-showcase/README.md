# BizFlow Demo Workbooks: Kyaw Myanmar

This directory contains curated demonstration datasets designed to showcase the full effectiveness, depth, and intelligence of the BizFlow / Shay Sett platform for **Kyaw Myanmar** (`57ef1d0f-5584-47e8-941f-09179bad7560`).

---

## 1. Flagship Showcase: `BIZFLOW_Showcase_Wholesale_Kyaw_Myanmar.xlsx` (Recommended)

This is the comprehensive, end-to-end dataset that lights up **every single module and feature** of the system:

- **Location**: [`BIZFLOW_Showcase_Wholesale_Kyaw_Myanmar.xlsx`](file:///c:/Users/hp/Desktop/UXMM_HACKATHON/UXMM_NEXT/examples/demo-showcase/BIZFLOW_Showcase_Wholesale_Kyaw_Myanmar.xlsx) (also copied to `Downloads/` for quick browser upload).
- **Business**: Kyaw Myanmar Wholesale & Distribution (Yangon, Myanmar).
- **Opening Baseline**: 2026-04-01 with 5,000,000 MMK opening cash.
- **Demo Pin**:
  ```env
  AI_SYNTHETIC_DEMO_BUSINESS_ID=57ef1d0f-5584-47e8-941f-09179bad7560
  AI_SYNTHETIC_DEMO_IMPORT_SHA256=0e38feea621f0008507975f7c121133a0650ee1ce48d4a9543b810f3ae296774
  ```

### What It Showcases Across Each Feature

| Page / Feature | What It Displays & Proves |
| --- | --- |
| **Data Source** (`/data-source`) | Clean, validated import across 10 sheets with 0 errors. Fully auditable row revisions, stable IDs, and idempotent re-upload protection. |
| **Financial Health** (`/`) | Continuous 7-month sales history (April to October 2026) showing growing revenue curve, operating expenses (rent, staff wages, logistics, utilities), customer receivables (2,250,000 MMK), and supplier payables (3,875,000 MMK). |
| **Working Capital** (`/working-capital`) | Multi-product catalog with inventory turnover, fast-moving items (Rice, Palm Oil, Noodles), and **Dead Stock detection** (`P-SPICE-01` Masala packs with 85 units idle and 0 recent sales). Interactive scenario simulators ("Find Cash" & "Buffer Cash") for cash runway planning. |
| **Credit Hub** (`/credit`) | **Active KBZ Bank SME Term Loan** (12,000,000 MMK at 12% annual reducing-balance interest). 6 recorded payments made, 9,000,000 MMK outstanding principal, active countdown badge (`"X days remaining"`), full 24-month amortization schedule, and auditable repayment capacity vs liquid cash. |
| **AI Business Analyzer** (`/ai-analyzer`) | Evidence-backed findings synthesizing multi-module signals: uncollected customer receivables, supplier payables due, and dead stock. Each finding delivers **The Issue** (deep risk diagnosis), **How to Fix** (concrete 3-step practical playbook), direct hub links, and collapsible evidence. |

---

## 2. Baseline Workbook: `bizflow-showcase-kyaw-myanmar.xlsx`

The earlier baseline workbook illustrating partial loan terms and a 2-step version bump (from 1 to 2).

- **Demo Pin**:
  ```env
  AI_SYNTHETIC_DEMO_BUSINESS_ID=57ef1d0f-5584-47e8-941f-09179bad7560
  AI_SYNTHETIC_DEMO_IMPORT_SHA256=8c3e7be97161ba99e36fa1b1e29a390e329d7e13a4c3bc472aa9c1cfdca73c38
  ```

