import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, Landmark } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ApplicationFiles } from "./ApplicationFiles";

import type { ReadinessCategory } from "../types";

export type GuideSelection = { bank: string; productId: string };

type Copy = readonly [string, string];
const savedApplicationName = (label: string) => label.split(" · ").slice(0, -2).join(" · ") || label;
type Product = {
  id: string;
  name: string;
  purpose: Copy;
  term: Copy;
  amount?: Copy;
  rate: Copy;
  fees?: Copy;
  notes?: Copy[];
};
const kbzSource =
  "https://www.kbzbank.com/en/products-services/finance-your-business-international-trade/";
const kbzProducts = `${kbzSource}loans-2/`;
const yomaSource = "https://www.yomabank.com/en/business/";
const products: Record<string, Product[]> = {
  kbz: [
    {
      id: "term",
      name: "SME Term Loan",
      purpose: [
        "Fixed assets and business expansion",
        "ပုံသေပိုင်ဆိုင်မှုဝယ်ယူခြင်းနှင့် လုပ်ငန်းတိုးချဲ့ခြင်း",
      ],
      term: ["1–3 years", "၁–၃ နှစ်"],
      amount: ["MMK 10–1,000 million", "ကျပ်သန်း ၁၀–၁,၀၀၀"],
      rate: ["12% secured; 12–15% unsecured per year", "တစ်နှစ်လျှင် အာမခံပါ ၁၂%၊ အာမခံမပါ ၁၂–၁၅%"],
      notes: [
        [
          "Construction requests need a layout plan and cost estimate.",
          "ဆောက်လုပ်ရေးအတွက် မြေပုံနှင့် ကုန်ကျစရိတ်ခန့်မှန်းချက် လိုပါသည်။",
        ],
      ],
    },
    {
      id: "od",
      name: "SME Overdraft (OD)",
      purpose: [
        "Short-term working capital and inventory purchases",
        "ရေတိုလည်ပတ်ငွေနှင့် ကုန်ဝယ်ယူခြင်း",
      ],
      term: ["Up to 1 year", "၁ နှစ်အထိ"],
      amount: ["MMK 10–1,000 million", "ကျပ်သန်း ၁၀–၁,၀၀၀"],
      rate: ["12% secured; 12–15% unsecured per year", "တစ်နှစ်လျှင် အာမခံပါ ၁၂%၊ အာမခံမပါ ၁၂–၁၅%"],
    },
    {
      id: "jica",
      name: "JICA Two Steps Loan",
      purpose: [
        "Capital investment, with a working-capital allocation",
        "ရင်းနှီးမြှုပ်နှံမှုနှင့် လည်ပတ်ငွေအချို့",
      ],
      term: ["Up to 5 years", "၅ နှစ်အထိ"],
      amount: ["Up to MMK 500 million", "ကျပ်သန်း ၅၀၀ အထိ"],
      rate: [
        "7.5% secured; 7.5–15% unsecured per year",
        "တစ်နှစ်လျှင် အာမခံပါ ၇.၅%၊ အာမခံမပါ ၇.၅–၁၅%",
      ],
      notes: [
        [
          "The bank describes an 80% capital / 20% working-capital allocation. Sector exclusions apply; see the official product page.",
          "ဘဏ်က ရင်းနှီးမြှုပ်နှံမှု ၈၀%၊ လည်ပတ်ငွေ ၂၀% ဟု ဖော်ပြထားသည်။ လုပ်ငန်းအမျိုးအစား ကန့်သတ်ချက်များကို တရားဝင်စာမျက်နှာတွင် ကြည့်ပါ။",
        ],
      ],
    },
    {
      id: "contract",
      name: "Contract Financing",
      purpose: [
        "Financing for businesses awarded tenders",
        "တင်ဒါအောင်မြင်ထားသော လုပ်ငန်းများအတွက်",
      ],
      term: ["Up to 1 year", "၁ နှစ်အထိ"],
      amount: ["Up to 80% of contract value", "စာချုပ်တန်ဖိုး၏ ၈၀% အထိ"],
      rate: ["14% per year (unsecured)", "တစ်နှစ်လျှင် ၁၄% (အာမခံမပါ)"],
      notes: [
        [
          "Additional contract-specific requirements and charges must be confirmed with KBZ.",
          "စာချုပ်ဆိုင်ရာလိုအပ်ချက်နှင့် အခကြေးငွေများကို KBZ နှင့် အတည်ပြုပါ။",
        ],
      ],
    },
  ],
  yoma: [
    {
      id: "sme",
      name: "SME Business Loan",
      purpose: [
        "Business expansion and day-to-day cash flow",
        "လုပ်ငန်းတိုးချဲ့မှုနှင့် နေ့စဉ်လည်ပတ်ငွေ",
      ],
      term: ["1–3 years", "၁–၃ နှစ်"],
      rate: ["13–15% per year", "တစ်နှစ်လျှင် ၁၃–၁၅%"],
      fees: ["Establishment fee: 1% of loan amount", "စတင်ဆောင်ရွက်ခ — ချေးငွေပမာဏ၏ ၁%"],
      notes: [
        [
          "Listed collateral: land, land and building, condominium or apartment.",
          "ဖော်ပြထားသောအာမခံပစ္စည်း — မြေ၊ မြေနှင့်အဆောက်အအုံ၊ ကွန်ဒို သို့မဟုတ် တိုက်ခန်း။",
        ],
      ],
    },
    {
      id: "od",
      name: "Business Overdraft",
      purpose: [
        "Short-term working capital; interest on the amount used",
        "ရေတိုလည်ပတ်ငွေ၊ အသုံးပြုသောငွေအပေါ် အတိုးတွက်ခြင်း",
      ],
      term: ["Up to 12 months", "၁၂ လအထိ"],
      rate: [
        "13–15% per year; calculated daily, charged monthly",
        "တစ်နှစ်လျှင် ၁၃–၁၅%၊ နေ့စဉ်တွက်ပြီး လစဉ်ကောက်ခံသည်",
      ],
      fees: [
        "Establishment 1%; non-utilization 1%; renewal 0.75%",
        "စတင်ဆောင်ရွက်ခ ၁%၊ မသုံးစွဲမှုခ ၁%၊ သက်တမ်းတိုးခ ၀.၇၅%",
      ],
      notes: [
        [
          "Balance must be fully repaid for at least two weeks each year. Not for fixed-asset purchases.",
          "နှစ်စဉ် အနည်းဆုံး နှစ်ပတ်အတွင်း လက်ကျန်အပြည့်ဆပ်ထားရမည်။ ပုံသေပိုင်ဆိုင်မှုဝယ်ရန် မသုံးရပါ။",
        ],
      ],
    },
  ],
};
const kbzEligibility: Copy[] = [
  [
    "Operating business with at least 2 years of experience",
    "လုပ်ငန်းလည်ပတ်သက်တမ်း အနည်းဆုံး ၂ နှစ်ရှိခြင်း",
  ],
  ["A valid business license", "သက်တမ်းရှိ လုပ်ငန်းလိုင်စင်ရှိခြင်း"],
];
const kbzRequirements: Copy[] = [
  ["Valid business license", "သက်တမ်းရှိ လုပ်ငန်းလိုင်စင်"],
  ["Financial statements for the last 3 years", "နောက်ဆုံး ၃ နှစ်စာ ဘဏ္ဍာရေးရှင်းတမ်းများ"],
  [
    "Income tax receipts for the last 3 years where applicable; confirm exceptions with the bank",
    "သက်ဆိုင်ပါက နောက်ဆုံး ၃ နှစ်စာ အခွန်ပြေစာ၊ ခြွင်းချက်များကို ဘဏ်နှင့် အတည်ပြုရန်",
  ],
  [
    "NRC, household registration and residence evidence; other personal documents as applicable",
    "NRC၊ အိမ်ထောင်စုစာရင်း၊ နေထိုင်မှုအထောက်အထားနှင့် သက်ဆိုင်ရာ ကိုယ်ရေးစာရွက်စာတမ်းများ",
  ],
  [
    "Company registration, DICA extract, BOD resolution and trade licenses where applicable",
    "သက်ဆိုင်ပါက ကုမ္ပဏီမှတ်ပုံတင်၊ DICA extract၊ ဒါရိုက်တာအဖွဲ့ဆုံးဖြတ်ချက်နှင့် ကုန်သွယ်လိုင်စင်များ",
  ],
  [
    "Business-premises ownership or lease evidence; security documents for secured lending",
    "လုပ်ငန်းနေရာ ပိုင်ဆိုင်မှု သို့မဟုတ် ငှားရမ်းမှုအထောက်အထား၊ အာမခံပါချေးငွေအတွက် အာမခံစာရွက်စာတမ်းများ",
  ],
];
const yomaRequirements: Copy[] = [
  [
    "Business license, revenue tax receipts and financial statements",
    "လုပ်ငန်းလိုင်စင်၊ အခွန်ပြေစာနှင့် ဘဏ္ဍာရေးရှင်းတမ်းများ",
  ],
  ["Bank statements for the last year", "နောက်ဆုံး ၁ နှစ်စာ ဘဏ်စာရင်းရှင်းတမ်းများ"],
  [
    "BOD resolution or loan meeting minutes",
    "ဒါရိုက်တာအဖွဲ့ဆုံးဖြတ်ချက် သို့မဟုတ် ချေးငွေဆိုင်ရာအစည်းအဝေးမှတ်တမ်း",
  ],
  [
    "Sales or purchase vouchers with summaries",
    "အရောင်း သို့မဟုတ် အဝယ်ဘောက်ချာနှင့် အနှစ်ချုပ်များ",
  ],
];

export function applicationRequirements({ bank, productId }: GuideSelection): Copy[] {
  const product = products[bank]?.find((item) => item.id === productId);
  if (!product) return [];
  return bank === "kbz"
      ? kbzRequirements
      : [
          ...yomaRequirements,
          ...(product.id === "sme"
            ? [
                [
                  "Borrower/co-borrower: original NRC and household list, ward recommendation and one license photo",
                  "ချေးယူသူနှင့် ပူးတွဲချေးယူသူ၏ NRC/အိမ်ထောင်စုစာရင်းမူရင်း၊ ရပ်ကွက်ထောက်ခံစာနှင့် လိုင်စင်ဓာတ်ပုံ ၁ ပုံ",
                ] as Copy,
                [
                  "SME Business Loan specifies the last year of sales/purchase vouchers and summaries",
                  "SME Business Loan အတွက် နောက်ဆုံး ၁ နှစ်စာ အရောင်း/အဝယ်ဘောက်ချာနှင့် အနှစ်ချုပ် လိုအပ်သည်",
                ] as Copy,
              ]
            : []),
        ];
}

export function ApplicationSelector({ selection, onSelectionChange, onRemoveSaved, savedSelections = [] }: {
  selection: GuideSelection;
  onSelectionChange: (selection: GuideSelection) => void;
  onRemoveSaved?: (selection: GuideSelection) => Promise<void>;
  savedSelections?: { id: string; label: string; selection: GuideSelection; fileCount?: number; updatedAt?: string }[];
}) {
  const { language } = useTranslation();
  const copy = (text: Copy) => text[language === "my" ? 1 : 0];
  const [opened, setOpened] = useState("");
  const [removing, setRemoving] = useState("");
  const [removeError, setRemoveError] = useState("");
  const available = products[selection.bank]!;
  const product = available.find((item) => item.id === selection.productId) || available[0]!;
  const selectClass = "mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground";
  const openSaved = (item: typeof savedSelections[number]) => {
    onSelectionChange(item.selection);
    setOpened(item.label);
    window.requestAnimationFrame(() => document.getElementById("application-document-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return <section className="bf-card space-y-4" aria-label={copy(["Choose an application", "ချေးငွေလျှောက်လွှာ ရွေးချယ်ရန်"])}>
    <div>
      <h2 className="flex items-center gap-2.5 text-xl font-semibold">
        <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span>{copy(["Choose an application", "ချေးငွေလျှောက်လွှာ ရွေးချယ်ရန်"])}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy([
        "Select the bank and loan product whose documents you want to prepare.",
        "ပြင်ဆင်လိုသော စာရွက်စာတမ်းများအတွက် ဘဏ်နှင့် ချေးငွေအမျိုးအစားကို ရွေးပါ။",
      ])}</p>
    </div>
    <details className="group rounded-xl border bg-card" open={savedSelections.length < 3 ? true : undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium hover:bg-muted/50">
        <span>{copy(["Saved applications", "သိမ်းထားသော လျှောက်လွှာများ"])} <span className="text-muted-foreground">({savedSelections.length})</span></span>
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-2 border-t p-4">
      {savedSelections.length ? <div className="grid gap-3 sm:grid-cols-2">
        {savedSelections.map(item => <article key={item.id} className="rounded-xl border bg-background p-4 shadow-sm">
          <p className="font-semibold">{savedApplicationName(item.label)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.fileCount ?? 0} {copy(["saved files", "ဖိုင် သိမ်းထားသည်"])}
            {item.updatedAt ? ` · ${copy(["Updated", "နောက်ဆုံးပြင်ဆင်ချိန်"])} ${new Date(item.updatedAt).toLocaleDateString(language === "my" ? "my-MM" : "en-US")}` : ""}
          </p>
          <div className="mt-3 grid gap-2">
            <button type="button" className="bf-button w-full" onClick={() => openSaved(item)}>
              {copy(["Continue application", "လျှောက်လွှာဆက်လုပ်ရန်"])}
            </button>
            {onRemoveSaved && <button type="button" disabled={!!removing} className="min-h-10 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60" onClick={() => {
              if (!window.confirm(copy(["Remove this saved application and all its documents? This cannot be undone.", "ဤသိမ်းထားသော လျှောက်လွှာနှင့် စာရွက်စာတမ်းအားလုံးကို ဖယ်ရှားမည်လား။ ပြန်လည်ရယူ၍ မရပါ။"]))) return;
              setRemoving(item.id); setRemoveError("");
              void onRemoveSaved(item.selection).then(() => { if (opened === item.label) setOpened(""); }).catch(failure => setRemoveError(failure instanceof Error ? failure.message : copy(["Could not remove the application.", "လျှောက်လွှာကို ဖယ်ရှား၍ မရပါ။"]))).finally(() => setRemoving(""));
            }}>{removing === item.id ? copy(["Removing…", "ဖယ်ရှားနေသည်…"]) : copy(["Remove saved application", "သိမ်းထားသော လျှောက်လွှာကို ဖယ်ရှားရန်"])}</button>}
          </div>
        </article>)}
      </div> : <p className="text-xs text-muted-foreground">{copy(["Applications appear here automatically after you upload a file.", "ဖိုင်တင်ပြီးသော လျှောက်လွှာများကို ဤစာရင်းတွင် အလိုအလျောက် သိမ်းပေးပါမည်။"])}</p>}
      {opened && <p role="status" className="text-sm font-medium text-primary">{copy(["Saved application opened:", "သိမ်းထားသော လျှောက်လွှာကို ဖွင့်ပြီးပါပြီ။"])} {savedApplicationName(opened)}</p>}
      {removeError && <p role="alert" className="text-sm text-destructive">{removeError}</p>}
      </div>
    </details>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">
        {copy(["Bank", "ဘဏ်"])}
        <select className={selectClass} value={selection.bank} onChange={event => {
          const bank = event.target.value;
          onSelectionChange({ bank, productId: products[bank]![0]!.id });
        }}>
          <option value="kbz">KBZ Bank</option>
          <option value="yoma">Yoma Bank</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        {copy(["Loan product", "ချေးငွေအမျိုးအစား"])}
        <select className={selectClass} value={product.id} onChange={event => onSelectionChange({ bank: selection.bank, productId: event.target.value })}>
          {available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
  </section>;
}

export function BankLoanGuide({ onViewRecords, businessId = "preview", selection, onSelectionChange, preparationOnly = false, records, savedSelections = [], showSelector = true }: {
  onViewRecords: () => void; businessId?: string; selection?: GuideSelection;
  onSelectionChange?: (selection: GuideSelection) => void; preparationOnly?: boolean;
  records?: ReadinessCategory[];
  savedSelections?: { id: string; label: string; selection: GuideSelection; fileCount?: number; updatedAt?: string }[];
  showSelector?: boolean;
}) {
  const { language } = useTranslation();
  const copy = (text: Copy) => text[language === "my" ? 1 : 0];
  const [localSelection, setLocalSelection] = useState<GuideSelection>({ bank: "kbz", productId: "term" });
  const [opened, setOpened] = useState("");
  const { bank, productId } = selection || localSelection;
  const select = (next: GuideSelection) => { setLocalSelection(next); onSelectionChange?.(next); };
  const available = products[bank]!;
  const product = available.find((item) => item.id === productId) || available[0]!;
  const source =
    bank === "kbz"
      ? kbzProducts
      : `${yomaSource}${product.id === "sme" ? "sme-business-loan" : "business-overdraft"}/`;
  const requirements = applicationRequirements({ bank, productId: product.id });
  const selectClass =
    "mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground";
  return (
    <section className="space-y-4">
      {showSelector && <div className="bf-card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Landmark size={21} className="text-primary" />
          {copy(preparationOnly ? ["Prepare this application", "ဤချေးငွေလျှောက်လွှာအတွက် ပြင်ဆင်ရန်"] : ["Bank loan guide", "ဘဏ်ချေးငွေလမ်းညွှန်"])}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy(preparationOnly ? [
            "Choose a bank and loan product to upload files, or reopen a saved application.",
            "ဖိုင်တင်ရန် ဘဏ်နှင့် ချေးငွေအမျိုးအစားကို ရွေးပါ။ ဖိုင်တင်ထားပြီးသော လျှောက်လွှာကိုလည်း ပြန်ဖွင့်နိုင်ပါသည်။",
          ] : [
            "Explore published business loan information. This guide does not change your recorded loans or assess approval.",
            "ဘဏ်ထုတ်ပြန်ထားသော လုပ်ငန်းချေးငွေအချက်အလက်များကို လေ့လာနိုင်ပါသည်။ ရှိပြီးသားချေးငွေများကို မပြောင်းလဲသကဲ့သို့ ခွင့်ပြုနိုင်မှုကိုလည်း မဆုံးဖြတ်ပါ။",
          ])}
        </p>
        {preparationOnly && <details className="group rounded-xl border bg-card" open={savedSelections.length < 3 ? true : undefined}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium hover:bg-muted/50">
            <span>{copy(["Saved applications", "သိမ်းထားသော လျှောက်လွှာများ"])} <span className="text-muted-foreground">({savedSelections.length})</span></span>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-2 border-t p-4">
          {savedSelections.length ? <div className="grid gap-3 sm:grid-cols-2">
            {savedSelections.map(item => <article key={item.id} className="rounded-xl border bg-background p-4 shadow-sm">
              <p className="font-semibold">{savedApplicationName(item.label)}</p>
              <button type="button" className="bf-button mt-3 w-full" onClick={() => {
                select(item.selection);
                setOpened(item.label);
                window.requestAnimationFrame(() => document.getElementById("application-document-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}>{copy(["Continue application", "လျှောက်လွှာဆက်လုပ်ရန်"])}</button>
            </article>)}
          </div> : <p className="text-xs text-muted-foreground">{copy(["Applications appear here automatically after you upload a file.", "ဖိုင်တင်ပြီးသော လျှောက်လွှာများကို ဤစာရင်းတွင် အလိုအလျောက် သိမ်းပေးပါမည်။"])}</p>}
          {opened && <p role="status" className="text-sm font-medium text-primary">{copy(["Saved application opened:", "သိမ်းထားသော လျှောက်လွှာကို ဖွင့်ပြီးပါပြီ။"])} {savedApplicationName(opened)}</p>}
          </div>
        </details>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {copy(["Bank", "ဘဏ်"])}
            <select
              className={selectClass}
              value={bank}
              onChange={(event) => {
                const next = event.target.value;
                select({ bank: next, productId: products[next]![0]!.id });
              }}
            >
              <option value="kbz">KBZ Bank</option>
              <option value="yoma">Yoma Bank</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            {copy(["Loan product", "ချေးငွေအမျိုးအစား"])}
            <select
              className={selectClass}
              value={product.id}
              onChange={(event) => select({ bank, productId: event.target.value })}
            >
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>}
      <div className={preparationOnly ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
        {!preparationOnly && <article className="bf-card space-y-4">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">{copy(product.purpose)}</p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{copy(["Term", "သက်တမ်း"])}</dt>
              <dd className="mt-1 font-semibold">{copy(product.term)}</dd>
            </div>
            {product.amount && (
              <div>
                <dt className="text-muted-foreground">
                  {copy(["Published financing limit", "ထုတ်ပြန်ထားသောချေးငွေပမာဏ"])}
                </dt>
                <dd className="mt-1 font-semibold">{copy(product.amount)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">
                {copy(["Published annual interest", "ထုတ်ပြန်ထားသော နှစ်စဉ်အတိုးနှုန်း"])}
              </dt>
              <dd className="mt-1 font-semibold">{copy(product.rate)}</dd>
            </div>
            {product.fees && (
              <div>
                <dt className="text-muted-foreground">
                  {copy(["Published fees", "ထုတ်ပြန်ထားသောအခကြေးငွေများ"])}
                </dt>
                <dd className="mt-1">{copy(product.fees)}</dd>
              </div>
            )}
          </dl>
          {product.notes?.map((note) => (
            <p key={note[0]} className="text-sm text-muted-foreground">
              {copy(note)}
            </p>
          ))}
        </article>}
        <article className="bf-card">
          <h3 className="mb-3 text-lg font-semibold">
            {copy(preparationOnly ? ["Application checklist", "လျှောက်လွှာစစ်ဆေးစာရင်း"] : ["Application requirements", "လျှောက်ထားရန်လိုအပ်ချက်များ"])}
          </h3>
          {bank === "kbz" && (
            <p className="mb-3 text-xs text-muted-foreground">
              {copy([
                "KBZ's general business-lending checklist; product-specific exceptions may apply.",
                "KBZ ၏ ယေဘုယျလုပ်ငန်းချေးငွေစာရင်းဖြစ်ပြီး product အလိုက် ခြွင်းချက်ရှိနိုင်ပါသည်။",
              ])}
            </p>
          )}
          <p className="mb-3 text-sm font-semibold">{bank === "kbz" ? "KBZ Bank" : "Yoma Bank"} · {product.name}</p>
          {bank === "kbz" && <p className="mb-4 text-sm text-muted-foreground">{kbzEligibility.map(copy).join(" · ")}</p>}
          {preparationOnly ? (
            <ApplicationFiles
              key={`${businessId}:${bank}:${product.id}`}
              businessId={businessId}
              bank={bank}
              productId={product.id}
              documents={requirements}
              records={records || []}
            />
          ) : <ul className="list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
            {requirements.map((requirement) => (
              <li key={requirement[0]}>{copy(requirement)}</li>
            ))}
          </ul>}
        </article>
      </div>
      <div className="bf-card space-y-3 text-sm">
        <p className="font-medium">
          {copy([
            "Checked: 22 October 2026 · Published website information",
            "စစ်ဆေးရက် — ၂၂ အောက်တိုဘာ ၂၀၂၆ · ဝက်ဘ်ဆိုက်ထုတ်ပြန်ချက်",
          ])}
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline"
          >
            {copy(["Official product page", "တရားဝင် product စာမျက်နှာ"])}
            <ExternalLink size={14} />
          </a>
          {bank === "kbz" && (
            <a
              href={kbzSource}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {copy(["KBZ requirements and rates", "KBZ လိုအပ်ချက်နှင့် နှုန်းထားများ"])}
            </a>
          )}
        </div>
        <p className="text-muted-foreground">
          {copy([
            "Terms and availability may change. Confirm the current offer, fees and eligibility with the bank. Use your signed loan agreement for existing loan calculations.",
            "သတ်မှတ်ချက်နှင့် ရရှိနိုင်မှု ပြောင်းလဲနိုင်ပါသည်။ လက်ရှိနှုန်းထား၊ အခကြေးငွေနှင့် လျှောက်ထားနိုင်မှုကို ဘဏ်နှင့် အတည်ပြုပါ။ ရှိပြီးသားချေးငွေတွက်ချက်ရာတွင် မိမိလက်မှတ်ထိုးထားသော စာချုပ်ကိုသာ အသုံးပြုပါ။",
          ])}
        </p>
        {!preparationOnly && <button type="button" className="bf-button-secondary" onClick={onViewRecords}>
          {copy(["Prepare this application", "ဤချေးငွေလျှောက်လွှာအတွက် ပြင်ဆင်ရန်"])}
        </button>}
      </div>
    </section>
  );
}

export function applicationProductName(selection: GuideSelection): string | undefined {
  return products[selection.bank]?.find((item) => item.id === selection.productId)?.name;
}
