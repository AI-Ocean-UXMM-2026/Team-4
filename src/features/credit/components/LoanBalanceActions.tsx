import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";
import type { CreditSummary } from "../types";
import { NextPaymentForm } from "./NextPaymentForm";

export function LoanBalanceActions({businessId, balance, asOf}: {businessId:string; balance:NonNullable<CreditSummary["recorded_balances"]>[number]; asOf:string}) {
  const {language} = useTranslation();
  const c = (en:string,my:string) => language === "my" ? my : en;
  const cache = useQueryClient();
  const [editing,setEditing] = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [amount,setAmount] = useState(balance.outstanding_principal_mmk);
  const [startDate,setStartDate] = useState(balance.loan_start_date || "");
  const [endDate,setEndDate] = useState(balance.loan_end_date || "");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const run = async (method:string) => {
    setBusy(true);setError("");
    try {
      await api(`/api/v1/credit/recorded-balances/${encodeURIComponent(balance.id)}?business_id=${encodeURIComponent(businessId)}`, {method,...(method === "PUT" ? {body:JSON.stringify({outstanding_principal_mmk:amount,as_of_date:balance.as_of_date,loan_start_date:startDate || null,loan_end_date:endDate || null})} : {})});
      await cache.invalidateQueries({queryKey:["credit-summary",businessId]});setEditing(false);
    } catch(e) {setError(e instanceof Error ? e.message : c("Could not save changes.","ပြင်ဆင်မှု မသိမ်းနိုင်ပါ။"));}
    finally {setBusy(false);}
  };
  return <div className="space-y-3">
    <div className="flex justify-end gap-3 text-xs">
      <button type="button" disabled={busy} className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => {setEditing(!editing);setDeleting(false);setAmount(balance.outstanding_principal_mmk);setStartDate(balance.loan_start_date || "");setEndDate(balance.loan_end_date || "");}}><Pencil size={14}/>{c("Edit","ပြင်ရန်")}</button>
      <button type="button" disabled={busy} className="inline-flex items-center gap-1 text-destructive hover:underline" onClick={() => {setDeleting(true);setEditing(false);}}><Trash2 size={14}/>{c("Delete","ဖျက်ရန်")}</button>
    </div>
    {deleting && <div className="rounded-xl border p-3 text-sm space-y-3"><p>{c("Delete this loan balance and its recorded next payment?", "ဤချေးငွေလက်ကျန်နှင့် နောက်အရစ်ကျမှတ်တမ်းကို ဖျက်မည်လား။")}</p><button disabled={busy} className="mr-4 text-destructive underline" onClick={() => void run("DELETE")}>{c("Delete loan","ချေးငွေဖျက်ရန်")}</button><button disabled={busy} onClick={() => setDeleting(false)}>{c("Cancel","ပယ်ဖျက်ရန်")}</button></div>}
    {editing && <div className="rounded-xl border p-4 space-y-4">
      <form className="space-y-3" onSubmit={e => {e.preventDefault();void run("PUT");}}>
        <label className="block text-sm">{c("Outstanding principal (MMK)","လက်ကျန်အရင်း (ကျပ်)")}<input className="bf-input mt-2 w-full" required type="number" min="0.01" max="999999999999" step="0.01" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)}/></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">{c("Loan start date","ချေးငွေစယူသည့်ရက်")}<input className="bf-input mt-2 w-full" type="date" max={balance.as_of_date} value={startDate} disabled={busy} onChange={e => setStartDate(e.target.value)}/></label>
          <label className="block text-sm">{c("Loan end date","ချေးငွေပြီးဆုံးမည့်ရက်")}<input className="bf-input mt-2 w-full" type="date" min={startDate || balance.as_of_date} value={endDate} disabled={busy} onChange={e => setEndDate(e.target.value)}/></label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="bf-button-secondary" disabled={busy}>{c("Save changes","ပြင်ဆင်မှု သိမ်းရန်")}</button>
          <button type="button" className="bf-button-secondary" disabled={busy} onClick={() => {setEditing(false);setAmount(balance.outstanding_principal_mmk);setStartDate(balance.loan_start_date || "");setEndDate(balance.loan_end_date || "");setError("");}}>{c("Cancel","ပယ်ဖျက်ရန်")}</button>
        </div>
      </form>
      <NextPaymentForm key={`${balance.next_payment_date}:${balance.next_payment_mmk}`} businessId={businessId} balance={balance} asOf={asOf} editable onClose={() => {setEditing(false);setError("");}} onSaved={() => {setEditing(false);setError("");}} />
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
