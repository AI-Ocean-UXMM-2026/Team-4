import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";
import type { ReadinessCategory } from "../types";

type Copy = readonly [string, string];
type Document = { id: string; requirement_key: string; filename: string; size: number };
const categoryFor = (text: string) => /financial statements/i.test(text) ? "sales_history"
  : /license|registration|NRC|household|BOD|premises/i.test(text) ? "business_profile"
  : /bank statements/i.test(text) ? "cashflow_history"
  : /sales|purchase vouchers/i.test(text) ? "sales_history" : "lender_documents";

export function ApplicationFiles({ businessId, bank, productId, documents, records = [] }: {
  businessId: string; bank: string; productId: string; documents: Copy[]; records?: ReadinessCategory[];
}) {
  const { t, language } = useTranslation();
  const copy = (text: Copy) => text[language === "my" ? 1 : 0];
  const queryClient = useQueryClient();
  const queryKey = ["credit-documents", businessId, bank, productId];
  const params = new URLSearchParams({business_id: businessId, bank_id: bank, product_id: `${bank}-${productId}`});
  const base = `/api/v1/credit/documents?${params}`;
  const files = useQuery({queryKey, queryFn: () => api<{documents: Document[]}>(base)});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = records.length ? records : [{category: "lender_documents", title: "Application documents", record_count: 0, period_start: null, period_end: null}];
  const uploaded = files.data?.documents || [];
  const requirements = documents.map((label, index) => ({key: `doc-${index}`, label, category: records.length ? categoryFor(label[0]) : "lender_documents"}));
  const run = async (action: () => Promise<void>) => {
    setError(""); setBusy(true);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Upload failed"); }
    finally { setBusy(false); }
  };
  const fileRow = (key: string, label: string) => <div key={key} className="space-y-2 border-t pt-3">
    <label className="block text-sm">
      <span className="mb-2 block font-medium">{label}</span>
      <input aria-label={label} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy || files.isPending || files.isError}
        className="block max-w-full text-xs"
        onChange={event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          if (file.size > 4 * 1024 * 1024) { setError(copy(["Choose a file up to 4 MB.", "ဖိုင်အရွယ်အစား 4 MB ထက်မကျော်ရပါ။"])); return; }
          void run(async () => { const form = new FormData(); form.append("file", file);
            await api(`${base}&requirement_key=${encodeURIComponent(key)}`, {method: "POST", body: form});
            await queryClient.invalidateQueries({queryKey}); });
        }} />
    </label>
    {uploaded.filter(file => file.requirement_key === key).map(file => <div key={file.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/40 p-2 text-xs">
      <span className="min-w-0 break-all">{file.filename} · {Math.ceil(file.size / 1024)} KB</span>
      <span className="text-muted-foreground">{copy(["Uploaded · not verified", "ဖိုင်တင်ပြီး · အတည်မပြုရသေး"])}</span>
      <button className="underline" disabled={busy} onClick={() => void run(async () => {
        const blob = await api<Blob>(`/api/v1/credit/documents/${file.id}/download?business_id=${encodeURIComponent(businessId)}`);
        const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = file.filename; link.click(); URL.revokeObjectURL(url);
      })}>{copy(["Download", "ဒေါင်းလုဒ်"] )}</button>
      <button className="text-destructive underline" disabled={busy} onClick={() => void run(async () => {
        await api(`/api/v1/credit/documents/${file.id}?business_id=${encodeURIComponent(businessId)}`, {method: "DELETE"});
        await queryClient.invalidateQueries({queryKey});
      })}>{copy(["Remove", "ဖယ်ရှားရန်"])}</button>
    </div>)}
  </div>;
  return <section aria-label={copy(["Application files", "လျှောက်လွှာစာရွက်စာတမ်းဖိုင်များ"])} className="space-y-4">
    <p className="text-sm text-muted-foreground">{copy(["Upload PDF, PNG or JPEG files, up to 4 MB each. Files are saved for this business, bank and product. Imported Excel records are shown separately within each folder. Neither records nor uploads are bank verification.", "PDF၊ PNG သို့မဟုတ် JPEG ဖိုင်များကို တစ်ဖိုင် 4 MB အထိ တင်နိုင်ပါသည်။ ဖိုင်များကို ဤလုပ်ငန်း၊ ဘဏ်နှင့် ချေးငွေအမျိုးအစားအတွက် သိမ်းထားပါသည်။ Folder တစ်ခုစီတွင် Excel စာရင်းဒေတာကို သီးခြားဖော်ပြထားပါသည်။ ဒေတာနှင့်တင်ထားသောဖိုင်များသည် ဘဏ်အတည်ပြုချက် မဟုတ်ပါ။"])}</p>
    {files.isPending && <p role="status">{copy(["Loading files…", "ဖိုင်များ ဖတ်နေပါသည်…"])}</p>}
    {files.isError && <p role="alert">{copy(["Could not load files. Try again.", "ဖိုင်များ မဖတ်နိုင်ပါ။ ထပ်စမ်းပါ။"])} <button className="underline" onClick={() => void files.refetch()}>{copy(["Retry", "ထပ်စမ်းရန်"])}</button></p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy && <p role="status">{copy(["Saving…", "သိမ်းနေပါသည်…"])}</p>}
    <div className="grid items-start gap-4 md:grid-cols-2">
      {groups.map(group => {
        const rows = requirements.filter(item => item.category === group.category);
        return <article key={group.category} className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
          <h4 className="font-semibold">{t(group.title)}</h4>
          <p className="text-xs text-muted-foreground">{copy(["Imported Excel records", "Excel မှတင်သွင်းထားသော မှတ်တမ်း"])}: {group.record_count}</p>
          {group.period_start && group.period_end && <p className="text-xs text-muted-foreground">
            {t("Period covered:")} {group.period_start.split("-").slice(1).concat(group.period_start.slice(0, 4)).join("/")} – {group.period_end.split("-").slice(1).concat(group.period_end.slice(0, 4)).join("/")} (MM/DD/YYYY)
          </p>}
          {rows.length ? rows.map(item => fileRow(item.key, copy(item.label))) : fileRow(group.category, copy(["Supporting file", "အထောက်အထားဖိုင်"]))}
        </article>;
      })}
    </div>
  </section>;
}
