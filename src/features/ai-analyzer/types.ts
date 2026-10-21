export type Evidence = { metric: string; value: string };
export type Insight = {
  id: string;
  category: "liquidity" | "working_capital" | "credit" | "data_quality";
  priority: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: Evidence[];
  suggested_actions: string[];
  assumptions: string[];
};
export type AIAnalysis = {
  business_id: string;
  status: "completed" | "rules_only" | "insufficient_data" | "unavailable";
  data_as_of: string | null;
  source_version: number;
  import_batch_id: string | null;
  generated_at: string;
  outdated: boolean;
  insights: Insight[];
  warnings: string[];
  disclaimer: string;
};
