import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";
import catalog from "../../../../shared/contracts/loan-products.json";

export function LoanRecording({ businessId, hasLoans }: { businessId: string; hasLoans: boolean }) {
  const { language } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [savedLoan, setSavedLoan] = useState(false);
  const canCollapse = hasLoans || savedLoan;
  if (canCollapse && !adding) return <div className="space-y-3">
    {savedLoan && <p role="status" className="text-sm">{language === "my" ? "ချေးငွေလက်ကျန်ကို သိမ်းဆည်းပြီးပါပြီ။" : "Loan balance saved."}</p>}
    <div className="flex justify-center">
      <button
        type="button"
        className="bf-button-secondary w-4/5 border-2 bg-card py-3 shadow-sm hover:bg-primary/10"
        onClick={() => { setAdding(true); setSavedLoan(false); }}
      >
        <Plus size={18} aria-hidden="true" />
        {language === "my" ? "နောက်ထပ်ချေးငွေ မှတ်တမ်းတင်ရန်" : "Record another loan"}
      </button>
    </div>
  </div>;
  return <div className="space-y-3">
    {canCollapse && <button type="button" className="bf-button-secondary" onClick={() => setAdding(false)}>{language === "my" ? "ပယ်ဖျက်ရန်" : "Cancel"}</button>}
    <RecordLoanForm businessId={businessId} onSaved={() => { setSavedLoan(true); setAdding(false); }} />
  </div>;
}

export function RecordLoanForm({ businessId, onSaved }: { businessId: string; onSaved?: () => void }) {
  const { language } = useTranslation();
  const copy = (en: string, my: string) => language === "my" ? my : en;
  const cache = useQueryClient();
  const [kind, setKind] = useState("bank");
  const [name, setName] = useState("");
  const [bankId, setBankId] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const bank = catalog.banks.find(item => item.id === bankId);
  const usesManualBankAnalysis = kind === "bank" && name.trim().length > 0 && !bank;
  const [amount, setAmount] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const field = "mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm";
  return <form className="bf-card space-y-5" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setSaved(false);
    try {
      await api(`/api/v1/credit/recorded-balances?business_id=${encodeURIComponent(businessId)}`, {method: "POST", body: JSON.stringify({
        lender_kind: kind, lender_name: name.trim(), outstanding_principal_mmk: amount, as_of_date: today,
        loan_start_date: startDate || null, loan_end_date: endDate || null,
        bank_id: kind === "bank" ? bankId || null : null,
        loan_product_id: kind === "bank" ? productId || productName.trim() || null : null,
      })});
      setName(""); setBankId(""); setProductId(""); setProductName(""); setAmount(""); setStartDate(""); setEndDate(""); setSaved(true);
      await cache.invalidateQueries({queryKey: ["credit-summary", businessId]});
      onSaved?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save loan."); }
    finally { setBusy(false); }
  }}>
    <h2 className="text-xl font-semibold">{copy("Record an existing loan", "ရှိပြီးသားချေးငွေ မှတ်တမ်းတင်ရန်")}</h2>
    <fieldset disabled={busy} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold">{copy("1. Please identify the lender.", "၁။ ချေးငွေပေးအပ်သူကို ဖော်ပြပေးပါ။")}
          <select className={field} value={kind} onChange={event => {setKind(event.target.value); setName(""); setBankId(""); setProductId(""); setProductName("");}}>
            <option value="bank">{copy("Bank", "ဘဏ်")}</option><option value="individual">{copy("Individual lender", "လူပုဂ္ဂိုလ်")}</option>
          </select>
        </label>
        <label className="mt-3 block text-sm">{kind === "bank" ? copy("Bank name", "ဘဏ်အမည်") : copy("Lender name or reference name", "ချေးငွေပေးသူအမည် သို့မဟုတ် မှတ်မိလွယ်သောအမည်")}
          {kind === "bank" ? <>
            <input className={field} required list="recorded-loan-banks" maxLength={200} placeholder={copy("Type or choose a bank", "ဘဏ်အမည် ရိုက်ထည့်ပါ သို့မဟုတ် ရွေးပါ")} value={name} onChange={event => {
              const value = event.target.value;
              const chosen = catalog.banks.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
              setName(value); setBankId(chosen?.id || ""); setProductId(""); setProductName("");
            }} />
            <datalist id="recorded-loan-banks">{catalog.banks.map(item => <option key={item.id} value={item.name} />)}</datalist>
          </> : <input className={field} required maxLength={200} value={name} onChange={event => setName(event.target.value)} />}
        </label>
        {kind === "bank" && <label className="mt-3 block text-sm">{copy("Loan product (optional)", "ချေးငွေအမျိုးအစား (မဖြစ်မနေမဟုတ်ပါ)")}
          <input className={field} list="recorded-loan-products" maxLength={80} placeholder={copy("Type or choose a loan product", "ချေးငွေအမျိုးအစား ရိုက်ထည့်ပါ သို့မဟုတ် ရွေးပါ")} value={productName} onChange={event => {
            const value = event.target.value;
            const chosen = bank?.products.find(product => product.name.toLowerCase() === value.trim().toLowerCase());
            setProductName(value); setProductId(chosen?.id || "");
          }} />
          <datalist id="recorded-loan-products">{bank?.products.map(product => <option key={product.id} value={product.name} />)}</datalist>
        </label>}
        {usesManualBankAnalysis && <p role="alert" className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          {copy(
            "This bank is not in the KBZ or Yoma product catalog. Analysis will use only the balance and repayment details you enter manually. Treat the result as an estimate and check it against your signed loan agreement or bank statement.",
            "ဤဘဏ်သည် KBZ သို့မဟုတ် Yoma ချေးငွေထုတ်ကုန်စာရင်းတွင် မပါဝင်ပါ။ ခွဲခြမ်းစိတ်ဖြာမှုသည် သင်ကိုယ်တိုင်ဖြည့်သွင်းသော လက်ကျန်နှင့် ပြန်ဆပ်မှုအချက်အလက်များကိုသာ အသုံးပြုမည်။ ရလဒ်ကို ခန့်မှန်းချက်အဖြစ်သာ သတ်မှတ်ပြီး လက်မှတ်ရေးထိုးထားသော ချေးငွေစာချုပ် သို့မဟုတ် ဘဏ်စာရင်းနှင့် တိုက်ဆိုင်စစ်ဆေးပါ။",
          )}
        </p>}
      </div>
      <label className="block text-sm font-semibold">{copy("2. What is the current outstanding principal? (MMK)", "၂။ လက်ရှိ ပြန်ဆပ်ရန်ကျန်ရှိသော အရင်းပမာဏကို ဖော်ပြပေးပါ။ (ကျပ်)")}
        <input className={field} required type="number" min="0.01" max="999999999999" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} />
        <span className="mt-2 block text-xs font-normal text-muted-foreground">{copy("Enter principal only. Exclude interest and fees.", "အရင်းပမာဏကိုသာ ဖြည့်ပါ။ အတိုးနှင့် အခကြေးငွေများ မထည့်ပါနှင့်။")}</span>
      </label>
      <label className="block text-sm font-semibold">{copy("3. Loan start date (optional)", "၃။ ချေးငွေစယူသည့်ရက် (မဖြစ်မနေမဟုတ်ပါ)")}
        <input className={field} type="date" max={today} value={startDate} onChange={event => setStartDate(event.target.value)} />
      </label>
      <label className="block text-sm font-semibold">{copy("4. Loan end date (optional)", "၄။ ချေးငွေပြီးဆုံးမည့်ရက် (မဖြစ်မနေမဟုတ်ပါ)")}
        <input className={field} type="date" min={startDate || today} value={endDate} onChange={event => setEndDate(event.target.value)} />
      </label>
    </fieldset>
    <p className="text-xs text-muted-foreground">{copy("This records your stated balance only. Original principal, payment history, interest and future installments are not inferred.", "သင်ဖော်ပြသော လက်ကျန်အရင်းကိုသာ သိမ်းဆည်းပါမည်။ မူလချေးငွေ၊ ပေးချေမှုမှတ်တမ်း၊ အတိုးနှင့် နောင်အရစ်ကျများကို ခန့်မှန်းတွက်ချက်မည် မဟုတ်ပါ။")}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="text-sm">{copy("Loan balance saved.", "ချေးငွေလက်ကျန်ကို သိမ်းဆည်းပြီးပါပြီ။")}</p>}
    <button disabled={busy} className="bf-button" type="submit">{busy ? copy("Saving…", "သိမ်းနေပါသည်…") : copy("Save loan", "ချေးငွေသိမ်းရန်")}</button>
  </form>;
}
