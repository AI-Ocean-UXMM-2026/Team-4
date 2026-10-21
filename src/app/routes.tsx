import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AIAnalysis, Checklist, Survive } from "@/components/PrototypeModules";
import { snapshotDisplay, type DisplayData } from "@/lib/snapshotAdapter";
import { Loading, usePlatform, useSnapshot } from "./providers";
import { ConnectedFinancialPage } from "@/features/financial/pages/ConnectedFinancialPage";

export type ModulePage = "financial" | "working-capital" | "credit" | "ai";
export function ModuleRoute({ page }: { page: ModulePage }) {
  if (page === "financial") return <ConnectedFinancialPage />;
  return <PrototypeModuleRoute page={page} />;
}

function PrototypeModuleRoute({ page }: { page: Exclude<ModulePage, "financial"> }) {
  const snapshot = useSnapshot();
  if (snapshot.isPending) return <Loading />;
  if (snapshot.isError) return <p role="alert">{snapshot.error.message}</p>;
  const display = snapshotDisplay(snapshot.data);
  if (!display)
    return (
      <div className="bf-card">
        <h1 className="text-2xl font-bold">Start with your workbook</h1>
        <p className="my-4 text-muted-foreground">
          Import a BizFlow workbook to populate this business.
        </p>
        <Link to="/data-source" className="bf-button inline-block">
          Open Data Source
        </Link>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-secondary px-4 py-3 text-xs text-primary">
        <span>
          Imported data · version {snapshot.data.source_version} · {display.monthLabel}
        </span>
        <Link to="/data-source" className="font-semibold underline">
          Manage workbook
        </Link>
      </div>
      {page === "working-capital" && (
        <Survive data={display.data} goCredit={() => window.location.assign("/credit")} />
      )}
      {page === "credit" && (
        <>
          <p className="text-sm text-muted-foreground">
            Prototype checklist. Document ticks stay in this page session. The credit module owner
            will add persisted readiness.
          </p>
          <Checklist />
        </>
      )}
      {page === "ai" && (
        <AnalysisPreview data={display.data} version={snapshot.data.source_version} />
      )}
      <p className="text-xs text-muted-foreground">
        Connected to your imported workbook. Scenario tools and the document checklist are prototype
        features.
      </p>
    </div>
  );
}

function AnalysisPreview({ data, version }: { data: DisplayData; version: number }) {
  const { business } = usePlatform();
  const queryClient = useQueryClient();
  type Preview = { data: DisplayData; version: number };
  const key = ["analysis-preview", business.id];
  const [analysis, updateAnalysis] = useState<Preview | null>(
    () => queryClient.getQueryData<Preview>(key) || null,
  );
  const setAnalysis = (next: Preview) => {
    queryClient.setQueryData(key, next);
    updateAnalysis(next);
  };
  const stale = analysis && analysis.version !== version;
  return (
    <div className="space-y-5">
      <div className="bf-card">
        <h1 className="text-3xl font-bold">AI Analyzer</h1>
        <p className="my-3 text-sm text-muted-foreground">
          AI service is not connected. You can generate the existing local scenario preview from
          this import. Financing and owner contributions are included in cash movements; this
          preview does not calculate accounting profit or loan eligibility.
        </p>
        <button className="bf-button" onClick={() => setAnalysis({ data: { ...data }, version })}>
          {analysis ? "Refresh preview from latest import" : "Generate local preview"}
        </button>
        {analysis && (
          <p
            role="status"
            className={`mt-3 text-sm ${stale ? "text-destructive" : "text-muted-foreground"}`}
          >
            {stale
              ? `Stale: preview uses version ${analysis.version}; data is now version ${version}. Refresh explicitly to regenerate.`
              : `Preview generated from version ${analysis.version}. Scenario edits below are local.`}
          </p>
        )}
      </div>
      {analysis && (
        <AIAnalysis
          key={analysis.version}
          data={analysis.data}
          setData={(next) => setAnalysis({ ...analysis, data: next })}
        />
      )}
    </div>
  );
}
