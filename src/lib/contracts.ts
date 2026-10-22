// Workbook v1. Exact monetary/quantity values cross the API as decimal strings.
export type DecimalString = string;
export type Business = { id: string; name: string; source_version: number };
export type RowIssue = { sheet: string; row: number; field: string; reason: string };
export type ImportResult = {
  import_batch_id?: string;
  status: "success" | "failed" | "up_to_date";
  source_version: number;
  row_counts: { inserted?: number; updated?: number; unchanged?: number; removed?: number };
  errors: RowIssue[];
  warnings: RowIssue[];
  created_at?: string;
};
export type SyncStatus = {
  source_id: string | null;
  kind: "manual" | "onedrive";
  source_version: number;
  graph_enabled: boolean;
  connected: boolean;
  linked: boolean;
  drive_id: string | null;
  item_id: string | null;
  last_import_at: string | null;
  last_checked_at: string | null;
  max_upload_bytes: number;
  imports: ImportResult[];
};
export type WorkbookFile = { id: string; name: string; drive_id: string; is_folder: boolean };
type Dated = { business_id: string; date: string };
export type WorkbookTables = {
  Settings: {
    business_id: string;
    business_name: string;
    currency: "MMK";
    opening_date: string;
    opening_cash_mmk: DecimalString;
  }[];
  Products: {
    business_id: string;
    product_id: string;
    name: string;
    opening_stock: DecimalString;
    unit_cost_mmk: DecimalString;
  }[];
  Sales: (Dated & {
    sale_id: string;
    product_id: string;
    quantity: DecimalString;
    unit_price_mmk: DecimalString;
    payment_type: "cash" | "credit";
    cash_received_mmk: DecimalString;
    unit_cost_at_sale_mmk?: DecimalString | null;
    cogs_mmk?: DecimalString | null;
  })[];
  CustomerReceipts: (Dated & { receipt_id: string; sale_id: string; amount_mmk: DecimalString })[];
  Purchases: (Dated & {
    purchase_id: string;
    product_id: string;
    quantity: DecimalString;
    unit_cost_mmk: DecimalString;
    payment_type: "cash" | "credit";
    cash_paid_mmk: DecimalString;
  })[];
  SupplierPayments: (Dated & {
    payment_id: string;
    purchase_id: string;
    amount_mmk: DecimalString;
  })[];
  Expenses: (Dated & {
    expense_id: string;
    category: string;
    amount_mmk: DecimalString;
    description: string;
    payment_status?: "paid" | "partial" | "unpaid" | null;
    paid_date?: string | null;
    amount_paid_mmk?: DecimalString | null;
  })[];
  Loans: (Dated & {
    loan_id: string;
    lender: string;
    loan_type: string;
    principal_mmk: DecimalString;
  })[];
  LoanPayments: (Dated & {
    payment_id: string;
    loan_id: string;
    principal_mmk: DecimalString;
    interest_mmk: DecimalString;
  })[];
  CashAdjustments: (Dated & {
    adjustment_id: string;
    direction: "in" | "out";
    amount_mmk: DecimalString;
    reason: string;
  })[];
};
export type Snapshot = {
  business_id: string;
  source_version: number;
  tables: WorkbookTables;
  synthetic?: boolean;
};
export type PlatformConfig = {
  auth_provider: "supabase";
  auth_configured: boolean;
  auth_status: { ready: boolean; code: string | null; message: string | null };
  auth_url: string;
  auth_key_fingerprint: string;
  password_policy: { min_length: number; required_characters: string[] };
  graph_enabled: boolean;
  modules: Record<string, boolean>;
};
export type BusinessDetails = {
  name: string;
  industry: string;
  city: string;
  phone: string;
  address: string;
  currency: "MMK";
};
export type AccountStatus = {
  user: { id: string; email: string; full_name: string };
  onboarding_complete: boolean;
  pending_business: BusinessDetails | null;
  owned_business_id: string | null;
};
export type UserProfile = {
  user: AccountStatus["user"];
  business: (BusinessDetails & { id: string }) | null;
};
export type ProfileUpdate = {
  full_name: string;
  business?: BusinessDetails;
};
