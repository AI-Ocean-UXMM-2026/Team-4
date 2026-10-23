import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";
import catalog from "../../../../shared/contracts/loan-products.json";
import type { GuideSelection } from "./BankLoanGuide";

type SavedApplication = {bank_id: string; product_id: string; filenames: string[]; updated_at: string};
export function SavedApplications({businessId, onOpen}: {businessId: string; onOpen: (selection: GuideSelection) => void}) {
  const {language} = useTranslation();
  const copy = (en: string, my: string) => language === "my" ? my : en;
  const query = useQuery({queryKey: ["saved-applications", businessId], queryFn: () =>
    api<{applications: SavedApplication[]}>(`/api/v1/credit/saved-applications?business_id=${encodeURIComponent(businessId)}`)});
  return <section className="bf-card space-y-4">
    <h2 className="text-xl font-semibold">{copy("Saved applications", "သိမ်းထားသော လျှောက်လွှာများ")}</h2>
    <p className="text-sm text-muted-foreground">{copy("Uploading a document automatically saves its bank and loan type here. Open an application to review files or continue uploading.", "စာရွက်စာတမ်းတင်လိုက်သည်နှင့် ဘဏ်နှင့်ချေးငွေအမျိုးအစားကို ဤနေရာတွင် အလိုအလျောက်သိမ်းထားပါသည်။ ဖိုင်များကြည့်ရန် သို့မဟုတ် ဆက်တင်ရန် လျှောက်လွှာကိုဖွင့်ပါ။")}</p>
    {query.isPending && <p role="status">{copy("Loading…", "ဖတ်နေပါသည်…")}</p>}
    {query.isError && <p role="alert">{copy("Could not load saved applications.", "သိမ်းထားသော လျှောက်လွှာများကို ဖတ်မရပါ။")} <button type="button" className="underline" onClick={() => void query.refetch()}>{copy("Retry", "ထပ်စမ်းရန်")}</button></p>}
    {query.data?.applications.length === 0 && <p className="text-sm">{copy("No saved applications yet. Upload your first document below to start.", "သိမ်းထားသော လျှောက်လွှာမရှိသေးပါ။ စတင်ရန် အောက်တွင်စာရွက်စာတမ်းတင်ပါ။")}</p>}
    {query.data?.applications.map(item => {
      const bank = catalog.banks.find(bank => bank.id === item.bank_id);
      const product = bank?.products.find(product => product.id === item.product_id);
      return <article key={`${item.bank_id}:${item.product_id}`} className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">{bank?.name || item.bank_id} · {product?.name || item.product_id}</h3>
        <p className="text-sm">{item.filenames.length} {copy("saved files · not verified", "ဖိုင် သိမ်းထားပြီး · အတည်မပြုရသေး")}</p>
        <ul className="list-disc pl-5 text-sm break-all">{item.filenames.map((name, index) => <li key={index}>{name}</li>)}</ul>
        <button type="button" className="bf-button" onClick={() => onOpen({bank: item.bank_id, productId: item.product_id.slice(item.bank_id.length + 1)})}>{copy("Open application", "လျှောက်လွှာဖွင့်ရန်")}</button>
      </article>;
    })}
  </section>;
}
