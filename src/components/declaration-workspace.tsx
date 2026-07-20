"use client";

import {
  ArrowRight,
  Building2,
  Check,
  CircleDollarSign,
  Cloud,
  Copy,
  Download,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DeclarationAssistant } from "@/components/declaration-assistant";
import {
  DeclarationStepHelp,
  type HelpLanguage,
} from "@/components/declaration-step-help";
import {
  calculateDeclaration,
  businessSectionSchema,
  createEmptyDeclaration,
  declarationSchema,
  employmentRatesByBusinessType,
  normalizeDeclaration,
  type DeclarationInput,
  type MonthEntry,
  type OfficerDetail,
} from "@/domain/declaration";
import { authClient } from "@/lib/auth-client";
import { cn, formatYen } from "@/lib/utils";

export type Section = "business" | "wages" | "rates" | "review";
type FieldErrors = Partial<Record<keyof DeclarationInput, string>>;
export type WorkspaceView = "editor" | "list" | "settings";
type DeclarationListItem = {
  id: string;
  fiscalYear: number;
  businessName: string;
  status: "draft" | "completed";
  formData: unknown;
  createdAt: string;
  updatedAt: string;
};
type ExportHistoryItem = {
  id: string;
  format: "xlsx" | "pdf";
  createdAt: string;
};
type BillingInfo = {
  configured: boolean;
  credits: { balance: number; lifetimePurchased: number; lifetimeUsed: number; complimentaryGranted: number };
  packs: { key: "credits_5" | "credits_20" | "credits_50"; credits: number; available: boolean }[];
  subscription?: { status: string; billingInterval: "month" | "year" | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  invoices: {
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    currency: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    createdAt: string;
  }[];
};
const sections: { id: Section; label: string; short: string }[] = [
  { id: "business", label: "事業情報", short: "01" },
  { id: "wages", label: "賃金集計", short: "02" },
  { id: "rates", label: "料率・納付設定", short: "03" },
  { id: "review", label: "計算結果", short: "04" },
];

function declarationPath(id: string, section: Section) {
  return `/dashboard/declarations/${id}/${section}`;
}

function validateSection(section: Section, data: DeclarationInput): FieldErrors {
  if (section !== "business") return {};
  const parsed = businessSectionSchema.safeParse(data);
  if (parsed.success) return {};
  return Object.fromEntries(
    parsed.error.issues.map((issue) => [
      issue.path[0],
      issue.path[0] === "fiscalYear"
        ? "年度は2020年から2100年の範囲で入力してください"
        : issue.message,
    ]),
  ) as FieldErrors;
}

const labelHelpKeys: Record<string, string> = {
  "申告済概算保険料額": "alreadyPaidEstimatedPremium",
  "納付回数": "installments",
  "還付・充当の処理": "refundHandling",
  "充当先": "refundHandling",
};

function helpKeyFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const directKey = target.closest<HTMLElement>("[data-help-key]")?.dataset.helpKey;
  if (directKey) return directKey;
  const labelText = target
    .closest("label")
    ?.querySelector<HTMLElement>(".field-label")
    ?.textContent?.trim();
  return labelText ? labelHelpKeys[labelText] ?? null : null;
}

const countFields: { key: keyof MonthEntry; label: string }[] = [
  { key: "regularWorkers", label: "常用" },
  { key: "officerWorkers", label: "役員" },
  { key: "temporaryWorkers", label: "臨時" },
  { key: "insuredWorkers", label: "雇用被保険者" },
  { key: "insuredOfficerWorkers", label: "役員(雇用)" },
];
const wageFields: { key: keyof MonthEntry; label: string }[] = [
  { key: "regularWages", label: "常用賃金" },
  { key: "officerWages", label: "役員賃金" },
  { key: "temporaryWages", label: "臨時賃金" },
  { key: "insuredWages", label: "雇用賃金" },
  { key: "insuredOfficerWages", label: "役員(雇用)賃金" },
];

function wageHelpKey(key: keyof MonthEntry) {
  if (key.startsWith("regular")) return "regularWorkers";
  if (key.startsWith("officer")) return "officerWorkers";
  if (key.startsWith("temporary")) return "temporaryWorkers";
  return "insuredWorkers";
}

export function DeclarationWorkspace({ user, aiEnabled, isAdmin, initialView = "list", initialSection = "business", initialDeclaration = null }: { user: { name: string; email: string }; aiEnabled: boolean; isAdmin: boolean; initialView?: WorkspaceView; initialSection?: Section; initialDeclaration?: { id: string; formData: unknown } | null }) {
  const router = useRouter();
  const [data, setData] = useState<DeclarationInput>(() => initialDeclaration ? normalizeDeclaration(initialDeclaration.formData) : createEmptyDeclaration());
  const [view] = useState<WorkspaceView>(initialView);
  const [section, setSection] = useState<Section>(initialSection);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [activeId, setActiveId] = useState<string | null>(initialDeclaration?.id ?? null);
  const [records, setRecords] = useState<DeclarationListItem[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [paywall, setPaywall] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [helpLanguage, setHelpLanguage] = useState<HelpLanguage>("ja");
  const [hoveredHelpKey, setHoveredHelpKey] = useState<string | null>(null);
  const [focusedHelpKey, setFocusedHelpKey] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(user.name);
  const [accountSaving, setAccountSaving] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    configured: false,
    credits: { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, complimentaryGranted: 0 },
    packs: [],
    invoices: [],
  });
  const [billingLoading, setBillingLoading] = useState<BillingInfo["packs"][number]["key"] | "month" | "year" | "portal" | null>(null);
  const editVersion = useRef(0);
  const helpLinkRoot = useRef<HTMLDivElement>(null);
  const result = useMemo(() => calculateDeclaration(data), [data]);
  const sectionIndex = sections.findIndex((item) => item.id === section);
  const activeHelpKey = focusedHelpKey ?? hoveredHelpKey;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedLanguage = window.localStorage.getItem("declaration-help-language");
      if (storedLanguage === "ja" || storedLanguage === "zh" || storedLanguage === "en") {
        setHelpLanguage(storedLanguage);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const root = helpLinkRoot.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-help-key]").forEach((element) => {
      element.toggleAttribute(
        "data-help-highlighted",
        Boolean(activeHelpKey && element.dataset.helpKey === activeHelpKey),
      );
    });
    root.querySelectorAll<HTMLElement>("label").forEach((label) => {
      const labelText = label.querySelector<HTMLElement>(".field-label")?.textContent?.trim();
      const helpKey = labelText ? labelHelpKeys[labelText] : undefined;
      if (!helpKey) return;
      label.classList.add("help-linked");
      label.toggleAttribute("data-help-highlighted", helpKey === activeHelpKey);
    });
    if (activeHelpKey) {
      const activeHelpItem = Array.from(
        root.querySelectorAll<HTMLElement>("aside [data-help-key]"),
      ).find((element) => element.dataset.helpKey === activeHelpKey);
      activeHelpItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeHelpKey, section, helpLanguage]);

  const changeHelpLanguage = (language: HelpLanguage) => {
    setHelpLanguage(language);
    window.localStorage.setItem("declaration-help-language", language);
  };

  const update = <K extends keyof DeclarationInput>(key: K, value: DeclarationInput[K]) => {
    editVersion.current += 1;
    setDirty(true);
    setData((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateMonth = (index: number, key: keyof MonthEntry, raw: string) => {
    const value = key === "month" ? raw : Math.max(0, Number(raw) || 0);
    editVersion.current += 1;
    setDirty(true);
    setData((current) => ({
      ...current,
      months: current.months.map((month, monthIndex) =>
        monthIndex === index ? { ...month, [key]: value } : month,
      ),
    }));
  };

  const updateBonus = (index: number, key: keyof MonthEntry, raw: string) => {
    const value = key === "month" ? raw : Math.max(0, Number(raw) || 0);
    editVersion.current += 1;
    setDirty(true);
    setData((current) => ({
      ...current,
      bonusEntries: current.bonusEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  };

  const updateOfficer = <K extends keyof OfficerDetail>(
    index: number,
    key: K,
    value: OfficerDetail[K],
  ) => {
    editVersion.current += 1;
    setDirty(true);
    setData((current) => ({
      ...current,
      officerDetails: current.officerDetails.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  };

  const refreshWorkspace = useCallback(async () => {
    const [declarationsResponse, exportsResponse, accountResponse] =
      await Promise.all([
        fetch("/api/declarations"),
        fetch("/api/exports"),
        fetch("/api/account"),
      ]);
    if (declarationsResponse.ok) {
      const payload = (await declarationsResponse.json()) as {
        items: DeclarationListItem[];
      };
      setRecords(payload.items);
    }
    if (exportsResponse.ok) {
      const payload = (await exportsResponse.json()) as {
        items: ExportHistoryItem[];
      };
      setExportHistory(payload.items);
    }
    if (accountResponse.ok) {
      const payload = (await accountResponse.json()) as {
        account: { name: string };
        billing: BillingInfo;
      };
      setAccountName(payload.account.name);
      setBillingInfo(payload.billing);
    }
    setWorkspaceLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshWorkspace]);

  const persist = useCallback(
    async (snapshot: DeclarationInput, recordId: string | null) => {
      const savingVersion = editVersion.current;
      setSaving(true);
      const response = await fetch(
        recordId ? `/api/declarations/${recordId}` : "/api/declarations",
        {
          method: recordId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        },
      );
      if (!response.ok) {
        setNotice("保存できませんでした");
        setSaving(false);
        return null;
      }
      const payload = (await response.json()) as { id: string };
      setActiveId(payload.id);
      if (editVersion.current === savingVersion) setDirty(false);
      setNotice("自動保存しました");
      setSaving(false);
      await refreshWorkspace();
      return payload.id;
    },
    [refreshWorkspace],
  );

  useEffect(() => {
    if (!dirty || saving || view !== "editor") return;
    const timer = window.setTimeout(() => {
      void persist(data, activeId).then((savedId) => {
        if (!activeId && savedId) router.replace(declarationPath(savedId, section));
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [activeId, data, dirty, persist, router, saving, section, view]);

  const save = async () => {
    setNotice("");
    const parsed = declarationSchema.safeParse(data);
    if (!parsed.success) {
      setNotice(parsed.error.issues[0]?.message || "入力内容をご確認ください");
      return;
    }
    const savedId = await persist(parsed.data, activeId);
    if (!activeId && savedId) router.replace(declarationPath(savedId, section));
  };

  const newDeclaration = () => {
    router.push("/dashboard/declarations/new/business");
  };

  const openDeclaration = (item: DeclarationListItem) => {
    router.push(declarationPath(item.id, "business"));
  };

  const copyDeclaration = async (item: DeclarationListItem) => {
    const copied = normalizeDeclaration(item.formData);
    copied.fiscalYear += 1;
    const id = await persist(copied, null);
    if (id) {
      router.push(declarationPath(id, "business"));
    }
  };

  const deleteDeclaration = async (item: DeclarationListItem) => {
    if (!window.confirm(`${item.fiscalYear}年度の申告書を削除しますか？`)) return;
    const response = await fetch(`/api/declarations/${item.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await refreshWorkspace();
      router.push("/dashboard");
    } else {
      setNotice("削除できませんでした");
    }
  };

  const saveAccount = async () => {
    setAccountSaving(true);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: accountName }),
    });
    setNotice(response.ok ? "アカウント情報を更新しました" : "更新できませんでした");
    setAccountSaving(false);
  };

  const navigateWorkspace = async (nextView: WorkspaceView) => {
    if (saving) {
      setNotice("保存完了後に移動してください");
      return;
    }
    if (view === "editor" && dirty) {
      await persist(data, activeId);
    }
    router.push(nextView === "settings" ? "/dashboard/settings" : "/dashboard");
  };

  const navigateSection = async (nextSection: Section) => {
    if (saving) {
      setNotice("保存完了後に移動してください");
      return false;
    }
    const currentIndex = sections.findIndex((item) => item.id === section);
    const nextIndex = sections.findIndex((item) => item.id === nextSection);
    if (nextIndex > currentIndex || view !== "editor") {
      for (let index = 0; index < nextIndex; index += 1) {
        const errors = validateSection(sections[index].id, data);
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setSection(sections[index].id);
          setNotice("必須項目を入力してください");
          router.replace(activeId ? declarationPath(activeId, sections[index].id) : "/dashboard/declarations/new/business");
          requestAnimationFrame(() => {
            const invalidField = document.querySelector<HTMLElement>(
              '[aria-invalid="true"]',
            );
            invalidField?.focus();
            invalidField?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return false;
        }
      }
    }
    setFieldErrors({});
    setNotice("");
    let targetId = activeId;
    if (!targetId || dirty) {
      targetId = await persist(data, activeId);
      if (!targetId) return false;
    }
    router.push(declarationPath(targetId, nextSection));
    return true;
  };

  const openCheckout = async (pack: BillingInfo["packs"][number]["key"]) => {
    setBillingLoading(pack);
    setNotice("");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (response.ok && payload.url) {
      window.location.assign(payload.url);
      return;
    }
    setNotice(
      payload.error === "stripe_not_configured"
        ? "Stripeのテスト設定がまだ完了していません"
        : "決済画面を開けませんでした",
    );
    setBillingLoading(null);
  };

  const exportFile = async (format: "excel" | "pdf") => {
    setNotice("");
    const response = await fetch(`/api/export/${format}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.status === 402) {
      setPaywall(true);
      return;
    }
    if (!response.ok) {
      setNotice("エクスポートできませんでした");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `年度更新_${data.fiscalYear}_${data.businessName || "申告書"}.${format === "excel" ? "xlsx" : "pdf"}`;
    anchor.click();
    URL.revokeObjectURL(url);
    await refreshWorkspace();
  };

  return (
    <div className="min-h-screen bg-[#f4f6f2] text-[#18231d]">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#dfe5df] bg-white/95 px-4 backdrop-blur lg:pl-[272px] lg:pr-7">
        <div className="flex items-center gap-3">
          <button className="button-ghost !px-2 lg:hidden" onClick={() => setMobileNav(true)} aria-label="メニュー"><Menu size={21} /></button>
          <div><p className="text-sm font-semibold">{view === "list" ? "申告書一覧" : view === "settings" ? "アカウント設定" : `${data.fiscalYear}年度 年度更新`}</p><p className="text-xs text-[#7d8981]">{view === "editor" ? (saving ? "保存中…" : dirty ? "未保存の変更" : "自動保存済み") : "マイワークスペース"}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {notice && <span className="hidden text-sm text-[#587066] sm:inline">{notice}</span>}
          {view === "editor" && <><span className="hidden items-center gap-1.5 text-xs text-[#718078] md:flex"><Cloud size={15} /> 自動保存</span><button className="button-secondary !px-3" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}<span className="hidden sm:inline">今すぐ保存</span></button></>}
        </div>
      </header>

      <Sidebar open={mobileNav} onClose={() => setMobileNav(false)} user={{ ...user, name: accountName }} isAdmin={isAdmin} view={view} setView={(next) => { void navigateWorkspace(next); setMobileNav(false); }} />

      <main className="px-4 pb-16 pt-24 lg:ml-[256px] lg:px-10">
        <div className={cn("mx-auto", view === "editor" ? "max-w-[1480px]" : "max-w-[1180px]")}>
          {view === "list" && <RecordsView records={records} exports={exportHistory} loading={workspaceLoading} onNew={newDeclaration} onOpen={openDeclaration} onCopy={copyDeclaration} onDelete={deleteDeclaration} />}
          {view === "settings" && <CreditSettingsView email={user.email} name={accountName} billing={billingInfo} saving={accountSaving} billingLoading={billingLoading} onNameChange={setAccountName} onSave={saveAccount} onCheckout={openCheckout} />}
          {view === "editor" && <><nav aria-label="入力ステップ" className="mb-6 rounded-2xl border border-[#e0e6e0] bg-white px-3 py-3 sm:px-5">
            <ol className="flex items-center">
              {sections.map((item, index) => {
                const state = index < sectionIndex ? "done" : index === sectionIndex ? "current" : "todo";
                return (
                  <li key={item.id} className={cn("flex min-w-0 items-center", index > 0 && "flex-1")}>
                    {index > 0 && <span aria-hidden className={cn("mx-2 h-px min-w-4 flex-1 sm:mx-3", index <= sectionIndex ? "bg-[#2c7357]" : "bg-[#dfe5df]")} />}
                    <button
                      type="button"
                      disabled={saving}
                      aria-current={state === "current" ? "step" : undefined}
                      onClick={() => void navigateSection(item.id)}
                      className={cn("group flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 transition", state === "todo" ? "text-[#8a958d] hover:text-[#4c5a51]" : "text-[#1e6349]")}
                    >
                      <span className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
                        state === "done" && "bg-[#e5f0e7] text-[#1e6349]",
                        state === "current" && "bg-[#174c3c] text-white shadow-[0_4px_12px_rgba(23,76,60,.28)]",
                        state === "todo" && "bg-[#eef1ed] group-hover:bg-[#e4e9e4]",
                      )}>
                        {state === "done" ? <Check size={15} /> : item.short}
                      </span>
                      <span className={cn("truncate text-sm", state === "current" ? "font-semibold" : "hidden font-medium md:inline")}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-[-.035em]">{sections[sectionIndex].label}</h1>
            <p className="mt-2 text-[#6c7870]">{section === "wages" ? "4月から翌年3月までの人数と賃金を入力します。" : "申告書の内容に沿って必要な項目を入力してください。"}</p>
          </div>

          <div
            ref={helpLinkRoot}
            className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
            onMouseOverCapture={(event) => setHoveredHelpKey(helpKeyFromTarget(event.target))}
            onMouseOutCapture={(event) => setHoveredHelpKey(helpKeyFromTarget(event.relatedTarget))}
            onFocusCapture={(event) => setFocusedHelpKey(helpKeyFromTarget(event.target))}
            onBlurCapture={(event) => setFocusedHelpKey(helpKeyFromTarget(event.relatedTarget))}
          >
            <div className="min-w-0">
              {section === "business" && <BusinessSection data={data} errors={fieldErrors} update={update} />}
              {section === "wages" && <WagesSection data={data} updateMonth={updateMonth} updateBonus={updateBonus} updateOfficer={updateOfficer} result={result} />}
              {section === "rates" && <RatesSection data={data} update={update} result={result} />}
              {section === "review" && <ReviewSection data={data} result={result} exportFile={exportFile} />}
            </div>
            <DeclarationStepHelp section={section} language={helpLanguage} onLanguageChange={changeHelpLanguage} />
          </div>

          <div className="mt-7 flex items-center justify-between">
            <button className="button-ghost" disabled={sectionIndex === 0 || saving} onClick={() => void navigateSection(sections[Math.max(0, sectionIndex - 1)].id)}>← 前へ</button>
            {sectionIndex < sections.length - 1 && <button className="button-primary" disabled={saving} onClick={() => void navigateSection(sections[sectionIndex + 1].id)}>次へ <ArrowRight size={17} /></button>}
          </div></>}
        </div>
      </main>

      {paywall && <CreditPaywall loading={billingLoading} configured={billingInfo.configured} packs={billingInfo.packs} onCheckout={openCheckout} onClose={() => setPaywall(false)} />}
      {view === "editor" && <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-2xl bg-[#174c3c] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(23,76,60,.3)] transition hover:-translate-y-0.5 hover:bg-[#103e31]"
      >
        <span className="relative"><Sparkles size={19} /><span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#b9e4a9]" /></span>
        申告助手
      </button>}
      <DeclarationAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        declaration={data}
        enabled={aiEnabled}
      />
    </div>
  );
}

function Sidebar({ open, onClose, user, isAdmin, view, setView }: { open: boolean; onClose: () => void; user: { name: string; email: string }; isAdmin: boolean; view: WorkspaceView; setView: (view: WorkspaceView) => void }) {
  return <><div className={cn("fixed inset-0 z-40 bg-black/30 transition lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} /><aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#dfe5df] bg-[#fbfcf9] p-4 transition-transform lg:z-40 lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="flex h-12 items-center justify-between px-2"><Link href="/" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-[#174c3c] text-white">年</span>年度更新ナビ</Link><button className="lg:hidden" onClick={onClose}><X size={20} /></button></div>
    <nav className="mt-7 space-y-1"><button onClick={() => setView("list")} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", view === "list" ? "bg-[#e5f0e7] text-[#1e6349]" : "text-[#657169] hover:bg-black/5")}><LayoutDashboard size={18} />申告書一覧</button><button onClick={() => setView("settings")} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", view === "settings" ? "bg-[#e5f0e7] text-[#1e6349]" : "text-[#657169] hover:bg-black/5")}><Settings size={18} />設定</button>{isAdmin && <Link href="/admin" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#657169] hover:bg-black/5"><ShieldCheck size={18} />管理コンソール</Link>}</nav>
    <div className="mt-auto rounded-2xl border border-[#dfe5df] bg-white p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#e7f0e8] text-sm font-semibold text-[#28654e]">{user.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-[#879189]">{user.email}</p></div><button aria-label="ログアウト" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}><LogOut size={17} className="text-[#7c8780]" /></button></div></div>
  </aside></>;
}

function RecordsView({ records, exports, loading, onNew, onOpen, onCopy, onDelete }: { records: DeclarationListItem[]; exports: ExportHistoryItem[]; loading: boolean; onNew: () => void; onOpen: (item: DeclarationListItem) => void; onCopy: (item: DeclarationListItem) => void; onDelete: (item: DeclarationListItem) => void }) {
  const dateTime = (value: string) => new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
  return <div><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#2e765a]">MY WORKSPACE</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">申告書一覧</h1><p className="mt-2 text-[#6c7870]">保存した年度更新データを開いて、続きから編集できます。</p></div><button className="button-primary" onClick={onNew}><Plus size={18} />新しい申告書</button></div><div className="grid gap-5 xl:grid-cols-[1fr_340px]"><section className="panel overflow-hidden"><div className="border-b border-[#e5eae5] px-6 py-5"><h2 className="font-semibold">申告データ</h2><p className="mt-1 text-sm text-[#7b867f]">変更内容は入力後1秒で自動保存されます</p></div>{loading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[#2c7357]" /></div> : records.length === 0 ? <div className="px-6 py-16 text-center"><FileSpreadsheet className="mx-auto text-[#9aa49d]" size={32} /><p className="mt-4 font-semibold">申告書はまだありません</p><p className="mt-2 text-sm text-[#7b867f]">新しい申告書を作成して入力を始めてください。</p><button className="button-primary mt-5" onClick={onNew}><Plus size={17} />作成する</button></div> : <div className="divide-y divide-[#e8ece8]">{records.map((item) => <article key={item.id} className="flex flex-col justify-between gap-4 px-6 py-5 transition hover:bg-[#fafbf8] sm:flex-row sm:items-center"><button className="min-w-0 text-left" onClick={() => onOpen(item)}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e9f3ea] text-[#27624c]"><FileSpreadsheet size={19} /></span><div><p className="font-semibold">{item.businessName || "名称未入力"}</p><p className="mt-1 text-sm text-[#738078]">{item.fiscalYear}年度 · {item.status === "draft" ? "下書き" : "完了"}</p></div></div><p className="mt-3 text-xs text-[#929b95]">最終更新 {dateTime(item.updatedAt)}</p></button><div className="flex items-center gap-1"><button className="button-ghost !px-2.5" title="編集" onClick={() => onOpen(item)}><Pencil size={17} /></button><button className="button-ghost !px-2.5" title="翌年度へ複製" onClick={() => void onCopy(item)}><Copy size={17} /></button><button className="button-ghost !px-2.5 text-red-700" title="削除" onClick={() => void onDelete(item)}><Trash2 size={17} /></button></div></article>)}</div>}</section><aside className="panel h-fit p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eef1ed] text-[#53655a]"><History size={19} /></span><div><h2 className="font-semibold">出力履歴</h2><p className="text-xs text-[#7b867f]">最近100件</p></div></div>{exports.length === 0 ? <p className="mt-6 text-sm leading-6 text-[#7b867f]">PDF・Excelを出力すると、日時と形式がここに記録されます。</p> : <div className="mt-5 divide-y divide-[#e8ece8]">{exports.slice(0, 10).map((item) => <div key={item.id} className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-sm font-medium"><Download size={15} />{item.format.toUpperCase()}</span><time className="text-xs text-[#849087]">{dateTime(item.createdAt)}</time></div>)}</div>}</aside></div></div>;
}

function CreditSettingsView({ email, name, billing, saving, billingLoading, onNameChange, onSave, onCheckout }: { email: string; name: string; billing: BillingInfo; saving: boolean; billingLoading: BillingInfo["packs"][number]["key"] | "month" | "year" | "portal" | null; onNameChange: (value: string) => void; onSave: () => void; onCheckout: (pack: BillingInfo["packs"][number]["key"]) => void }) {
  return <div className="mx-auto max-w-3xl"><div className="mb-8"><p className="text-sm font-semibold text-[#2e765a]">ACCOUNT</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">アカウント設定</h1><p className="mt-2 text-[#6c7870]">プロフィール、出力回数、請求書を管理できます。</p></div><section className="panel p-6 sm:p-8"><div className="flex items-center gap-3 border-b border-[#e8ece8] pb-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#e9f3ea] text-[#27624c]"><UserRound size={21} /></span><div><h2 className="font-semibold">プロフィール</h2><p className="mt-1 text-sm text-[#77837b]">ログインに使用するメールアドレスは変更できません</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label><span className="field-label">表示名</span><input className="field-input" value={name} onChange={(event) => onNameChange(event.target.value)} /></label><label><span className="field-label">メールアドレス</span><input className="field-input bg-[#f3f5f2]" value={email} readOnly /></label></div><div className="mt-7 flex justify-end"><button className="button-primary" onClick={onSave} disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}設定を保存</button></div></section><section className="panel mt-5 p-6 sm:p-8"><div className="border-b border-[#e8ece8] pb-5"><h2 className="font-semibold">出力回数・請求</h2><p className="mt-1 text-sm text-[#77837b]">サブスクリプションではなく、必要な回数だけ購入できます</p></div><div className="mt-6 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-[#174c3c] p-5 text-white"><p className="text-sm text-white/70">残り回数</p><p className="mt-2 text-3xl font-semibold">{billing.credits.balance}</p></div><div className="rounded-2xl bg-[#f4f6f2] p-5"><p className="text-sm text-[#78847c]">購入済み</p><p className="mt-2 text-2xl font-semibold">{billing.credits.lifetimePurchased}</p></div><div className="rounded-2xl bg-[#f4f6f2] p-5"><p className="text-sm text-[#78847c]">使用済み</p><p className="mt-2 text-2xl font-semibold">{billing.credits.lifetimeUsed}</p></div><div className="rounded-2xl bg-[#f4f6f2] p-5"><p className="text-sm text-[#78847c]">登録特典</p><p className="mt-2 text-2xl font-semibold">{billing.credits.complimentaryGranted}</p></div></div>{!billing.configured ? <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">Stripeテスト環境のキーと3つのPrice IDを設定すると、回数パックを購入できます。</div> : <div className="mt-6 grid gap-3 sm:grid-cols-3">{billing.packs.map((pack) => <button key={pack.key} className="rounded-2xl border border-[#dfe5df] p-5 text-left transition hover:border-[#2c7357]" onClick={() => onCheckout(pack.key)} disabled={!pack.available || billingLoading !== null}><p className="text-xl font-semibold">{pack.credits}回パック</p><p className="mt-2 text-sm text-[#748078]">1回のPDFまたはExcel出力で1回消費</p>{billingLoading === pack.key && <LoaderCircle className="mt-3 animate-spin" size={17} />}</button>)}</div>}{billing.invoices.length > 0 && <div className="mt-7"><h3 className="text-sm font-semibold">請求書</h3><div className="mt-3 divide-y divide-[#e8ece8]">{billing.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{invoice.number || invoice.id}</p><p className="mt-1 text-xs text-[#7b867f]">{new Date(invoice.createdAt).toLocaleDateString("ja-JP")} · {formatYen(invoice.amountPaid)}</p></div><div className="flex gap-2">{invoice.hostedInvoiceUrl && <a className="button-ghost !px-2" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">表示</a>}{invoice.invoicePdf && <a className="button-ghost !px-2" href={invoice.invoicePdf} target="_blank" rel="noreferrer">PDF</a>}</div></div>)}</div></div>}</section></div>;
}

function CreditPaywall({ configured, packs, loading, onCheckout, onClose }: { configured: boolean; packs: BillingInfo["packs"]; loading: BillingInfo["packs"][number]["key"] | "month" | "year" | "portal" | null; onCheckout: (pack: BillingInfo["packs"][number]["key"]) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#112019]/55 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[28px] bg-white p-7 shadow-2xl"><div className="flex justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-[#e8f3e9] text-[#216249]"><Sparkles size={23} /></span><button onClick={onClose}><X size={20} className="text-[#77837b]" /></button></div><h2 className="mt-6 text-2xl font-semibold tracking-tight">出力回数を購入</h2><p className="mt-3 leading-7 text-[#68756d]">登録時の無料回数を使い切りました。月額・年額契約はなく、購入した回数に有効期限はありません。</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{packs.map((pack) => <button key={pack.key} className="button-secondary h-14" disabled={!configured || !pack.available || loading !== null} onClick={() => onCheckout(pack.key)}>{loading === pack.key && <LoaderCircle className="animate-spin" size={16} />}{pack.credits}回</button>)}</div><p className="mt-3 text-center text-xs text-[#8a948d]">{configured ? "安全なStripe Checkoutへ移動します" : "管理者によるStripeテスト設定が必要です"}</p></div></div>;
}

export function SettingsView({ email, name, plan, billing, saving, billingLoading, onNameChange, onSave, onCheckout, onPortal }: { email: string; name: string; plan: "free" | "pro"; billing: BillingInfo; saving: boolean; billingLoading: "month" | "year" | "portal" | null; onNameChange: (value: string) => void; onSave: () => void; onCheckout: (interval: "month" | "year") => void; onPortal: () => void }) {
  const subscription = billing.subscription;
  return <div className="mx-auto max-w-3xl"><div className="mb-8"><p className="text-sm font-semibold text-[#2e765a]">ACCOUNT</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">アカウント設定</h1><p className="mt-2 text-[#6c7870]">プロフィール、利用プラン、請求書を管理できます。</p></div><section className="panel p-6 sm:p-8"><div className="flex items-center gap-3 border-b border-[#e8ece8] pb-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#e9f3ea] text-[#27624c]"><UserRound size={21} /></span><div><h2 className="font-semibold">プロフィール</h2><p className="mt-1 text-sm text-[#77837b]">ログインに使用するメールアドレスは変更できません</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label><span className="field-label">表示名</span><input className="field-input" value={name} onChange={(event) => onNameChange(event.target.value)} /></label><label><span className="field-label">メールアドレス</span><input className="field-input bg-[#f3f5f2]" value={email} readOnly /></label><div><span className="field-label">現在のプラン</span><div className="flex h-11 items-center"><span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", plan === "pro" ? "bg-[#174c3c] text-white" : "bg-[#eef1ed] text-[#5f6c64]")}>{plan === "pro" ? "Pro" : "Free"}</span></div></div></div><div className="mt-7 flex justify-end"><button className="button-primary" onClick={onSave} disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}設定を保存</button></div></section><section className="panel mt-5 p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 border-b border-[#e8ece8] pb-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">プラン・請求</h2><p className="mt-1 text-sm text-[#77837b]">Stripeの安全な画面で決済情報を管理します</p></div>{subscription && <button className="button-secondary" onClick={onPortal} disabled={billingLoading !== null}>{billingLoading === "portal" && <LoaderCircle className="animate-spin" size={16} />}請求ポータル</button>}</div>{!billing.configured ? <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">Stripeテスト環境のキーとPrice IDを設定すると、ここから月額・年額プランを購入できます。</div> : subscription ? <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-2xl bg-[#f4f6f2] p-4"><p className="text-[#78847c]">契約状態</p><p className="mt-2 font-semibold">{subscription.status} · {subscription.billingInterval === "year" ? "年額" : "月額"}</p></div><div className="rounded-2xl bg-[#f4f6f2] p-4"><p className="text-[#78847c]">現在期間の終了</p><p className="mt-2 font-semibold">{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ja-JP") : "—"}{subscription.cancelAtPeriodEnd ? "（解約予定）" : ""}</p></div></div> : <div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="rounded-2xl border border-[#dfe5df] p-5 text-left transition hover:border-[#2c7357]" onClick={() => onCheckout("month")} disabled={billingLoading !== null}><p className="font-semibold">Pro 月額</p><p className="mt-2 text-sm text-[#748078]">毎月更新。Stripe Checkoutで開始</p>{billingLoading === "month" && <LoaderCircle className="mt-3 animate-spin" size={17} />}</button><button className="rounded-2xl border border-[#dfe5df] p-5 text-left transition hover:border-[#2c7357]" onClick={() => onCheckout("year")} disabled={billingLoading !== null}><p className="font-semibold">Pro 年額</p><p className="mt-2 text-sm text-[#748078]">年1回更新。Stripe Checkoutで開始</p>{billingLoading === "year" && <LoaderCircle className="mt-3 animate-spin" size={17} />}</button></div>}{billing.invoices.length > 0 && <div className="mt-7"><h3 className="text-sm font-semibold">請求書</h3><div className="mt-3 divide-y divide-[#e8ece8]">{billing.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{invoice.number || invoice.id}</p><p className="mt-1 text-xs text-[#7b867f]">{new Date(invoice.createdAt).toLocaleDateString("ja-JP")} · {formatYen(invoice.amountPaid)}</p></div><div className="flex gap-2">{invoice.hostedInvoiceUrl && <a className="button-ghost !px-2" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">表示</a>}{invoice.invoicePdf && <a className="button-ghost !px-2" href={invoice.invoicePdf} target="_blank" rel="noreferrer">PDF</a>}</div></div>)}</div></div>}</section></div>;
}

function BusinessSection({ data, errors, update }: { data: DeclarationInput; errors: FieldErrors; update: <K extends keyof DeclarationInput>(key: K, value: DeclarationInput[K]) => void }) {
  const changeBusinessType = (businessType: DeclarationInput["businessType"]) => {
    const rates = employmentRatesByBusinessType[businessType];
    update("businessType", businessType);
    update("finalizedEmploymentRate", rates.finalized);
    update("estimatedEmploymentRate", rates.estimated);
  };
  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex items-center gap-3 border-b border-[#e8ece8] pb-5">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#e9f3ea] text-[#27624c]"><Building2 size={21} /></span>
        <div><h2 className="font-semibold">事業所の基本情報</h2><p className="mt-1 text-sm text-[#77837b]">お手元の申告書をご確認ください</p></div>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <label data-help-key="fiscalYear" className="help-linked rounded-xl">
          <span className="field-label">年度更新対象年度 *</span>
          <input className={cn("field-input", errors.fiscalYear && "border-red-500 focus:border-red-500 focus:ring-red-500/10")} type="number" required aria-invalid={Boolean(errors.fiscalYear)} aria-describedby={errors.fiscalYear ? "fiscal-year-error" : undefined} value={data.fiscalYear} onChange={(e) => update("fiscalYear", Number(e.target.value))} />
          {errors.fiscalYear && <p id="fiscal-year-error" className="mt-1.5 text-xs text-red-600">{errors.fiscalYear}</p>}
        </label>
        <label data-help-key="businessType" className="help-linked rounded-xl">
          <span className="field-label">事業の種類 *</span>
          <select className="field-input" required value={data.businessType} onChange={(e) => changeBusinessType(e.target.value as DeclarationInput["businessType"])}><option value="general">一般の事業</option><option value="agriculture">農林水産・清酒製造</option><option value="construction">建設の事業</option></select>
        </label>
        <label data-help-key="businessName" className="help-linked rounded-xl md:col-span-2">
          <span className="field-label">事業の名称 *</span>
          <input className={cn("field-input", errors.businessName && "border-red-500 focus:border-red-500 focus:ring-red-500/10")} required aria-invalid={Boolean(errors.businessName)} aria-describedby={errors.businessName ? "business-name-error" : undefined} value={data.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="株式会社サンプル" />
          {errors.businessName && <p id="business-name-error" className="mt-1.5 text-xs text-red-600">{errors.businessName}</p>}
        </label>
        <label data-help-key="laborInsuranceNumber" className="help-linked rounded-xl md:col-span-2">
          <span className="field-label">労働保険番号</span>
          <input className="field-input" value={data.laborInsuranceNumber} onChange={(e) => update("laborInsuranceNumber", e.target.value)} placeholder="00-0-00-000000-000" />
        </label>

        <div data-help-key="contact" role="group" aria-labelledby="contact-group-title" className="help-linked rounded-2xl border border-[#e2e8e2] bg-[#f8faf7] p-4 md:col-span-2 sm:p-5">
          <div className="mb-4 border-b border-[#e2e8e2] pb-3">
            <h3 id="contact-group-title" className="text-sm font-semibold text-[#3b5146]">連絡先・所在地</h3>
            <p className="mt-1 text-xs text-[#7a867e]">申告書に記載する事業所の連絡先をまとめて入力します</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="field-label">電話番号</span><input className="field-input" value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="03-1234-5678" /></label>
            <label><span className="field-label">郵便番号</span><input className="field-input" value={data.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="100-0001" /></label>
            <label className="md:col-span-2"><span className="field-label">事業の所在地</span><input className="field-input" value={data.address} onChange={(e) => update("address", e.target.value)} placeholder="東京都千代田区…" /></label>
          </div>
        </div>

        <label data-help-key="workDescription" className="help-linked rounded-xl md:col-span-2">
          <span className="field-label">具体的な業務又は作業の内容</span>
          <textarea className="field-input min-h-24 resize-y" value={data.workDescription} onChange={(e) => update("workDescription", e.target.value)} placeholder="主な業務内容を入力してください" />
        </label>

        <div data-help-key="secondedWorkers" role="group" aria-labelledby="seconded-workers-group-title" className="help-linked rounded-2xl border border-[#e2e8e2] bg-[#f8faf7] p-4 md:col-span-2 sm:p-5">
          <div className="mb-4 border-b border-[#e2e8e2] pb-3">
            <h3 id="seconded-workers-group-title" className="text-sm font-semibold text-[#3b5146]">出向者人数</h3>
            <p className="mt-1 text-xs text-[#7a867e]">該当者がいない場合は0人として扱われます</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="field-label">出向者（受入）</span><div className="relative"><input className="field-input !pr-10 text-right" type="number" min="0" value={data.incomingSecondedWorkers || ""} placeholder="0" onChange={(e) => update("incomingSecondedWorkers", Number(e.target.value) || 0)} /><span className="pointer-events-none absolute right-3 top-3 text-xs text-[#748078]">人</span></div></label>
            <label><span className="field-label">出向者（送出）</span><div className="relative"><input className="field-input !pr-10 text-right" type="number" min="0" value={data.outgoingSecondedWorkers || ""} placeholder="0" onChange={(e) => update("outgoingSecondedWorkers", Number(e.target.value) || 0)} /><span className="pointer-events-none absolute right-3 top-3 text-xs text-[#748078]">人</span></div></label>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberCell({ value, helpKey, onChange }: { value: number; helpKey: string; onChange: (value: string) => void }) { return <input data-help-key={helpKey} className="help-linked h-10 w-full min-w-24 rounded-lg border border-[#dfe5df] bg-white px-2.5 text-right text-sm outline-none focus:border-[#2d7458] focus:ring-3 focus:ring-[#2d7458]/10" type="number" min="0" value={value || ""} placeholder="0" onChange={(e) => onChange(e.target.value)} />; }

function WagesSection({ data, updateMonth, updateBonus, updateOfficer, result }: { data: DeclarationInput; updateMonth: (index: number, key: keyof MonthEntry, value: string) => void; updateBonus: (index: number, key: keyof MonthEntry, value: string) => void; updateOfficer: <K extends keyof OfficerDetail>(index: number, key: K, value: OfficerDetail[K]) => void; result: ReturnType<typeof calculateDeclaration> }) {
  const wageRows = (entries: MonthEntry[], updater: (index: number, key: keyof MonthEntry, value: string) => void, bonuses = false) => entries.map((entry, index) => <tr key={entry.month} className="border-t border-[#edf0ed] hover:bg-[#fafbf8]"><th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold">{entry.month}</th>{countFields.map((field) => <td key={field.key} className="px-2 py-2"><NumberCell helpKey={bonuses ? "bonuses" : wageHelpKey(field.key)} value={entry[field.key] as number} onChange={(v) => updater(index, field.key, v)} /></td>)}{wageFields.map((field) => <td key={field.key} className="px-2 py-2"><NumberCell helpKey={bonuses ? "bonuses" : wageHelpKey(field.key)} value={entry[field.key] as number} onChange={(v) => updater(index, field.key, v)} /></td>)}</tr>);
  return <div className="space-y-5"><section className="panel overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-[#e5eae5] p-6 sm:flex-row sm:items-center"><div><h2 className="font-semibold">月別・賞与 人数／賃金</h2><p className="mt-1 text-sm text-[#77837b]">原表どおり、金額は円単位で入力してください</p></div><span className="rounded-full bg-[#eef5ed] px-3 py-1.5 text-xs font-semibold text-[#397055]">12か月＋賞与3回</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-sm"><thead><tr className="bg-[#f4f6f2] text-left text-xs text-[#66736b]"><th className="sticky left-0 z-10 bg-[#f4f6f2] px-4 py-3">月</th>{countFields.map((f) => <th key={f.key} data-help-key={wageHelpKey(f.key)} className="help-linked px-2 py-3 text-center">{f.label}<span className="block font-normal">人数</span></th>)}{wageFields.map((f) => <th key={f.key} data-help-key={wageHelpKey(f.key)} className="help-linked px-2 py-3 text-center">{f.label}<span className="block font-normal">円</span></th>)}</tr></thead><tbody>{wageRows(data.months, updateMonth)}<tr><th colSpan={11} data-help-key="bonuses" className="help-linked bg-[#eef5ed] px-4 py-2 text-left text-xs font-semibold text-[#397055]">賞与</th></tr>{wageRows(data.bonusEntries, updateBonus, true)}</tbody></table></div></section><section data-help-key="officerWorkers" className="help-linked panel p-6"><h2 className="font-semibold">役員で労働者扱いの詳細</h2><p className="mt-1 text-sm text-[#77837b]">原表の備考欄（最大5名）</p><div className="mt-5 space-y-3">{data.officerDetails.map((officer, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label><span className="field-label">氏名 {index + 1}</span><input className="field-input" value={officer.name} onChange={(e) => updateOfficer(index, "name", e.target.value)} /></label><label><span className="field-label">役職</span><input className="field-input" value={officer.position} onChange={(e) => updateOfficer(index, "position", e.target.value)} /></label><label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={officer.employmentInsured} onChange={(e) => updateOfficer(index, "employmentInsured", e.target.checked)} />雇用保険資格あり</label></div>)}</div></section><div className="grid gap-4 sm:grid-cols-2"><SummaryCard title="労災保険対象賃金" value={formatYen(result.workersCompWages)} detail={`月平均 ${result.averageWorkers.toLocaleString()} 人`} /><SummaryCard title="雇用保険対象賃金" value={formatYen(result.employmentWages)} detail={`月平均 ${result.averageEmploymentInsured.toLocaleString()} 人`} /></div></div>;
}

function RatesSection({ data, update, result }: { data: DeclarationInput; update: <K extends keyof DeclarationInput>(key: K, value: DeclarationInput[K]) => void; result: ReturnType<typeof calculateDeclaration> }) {
  const rateInput = (key: "workersCompRate" | "finalizedEmploymentRate" | "estimatedEmploymentRate" | "generalContributionRate", label: string, suffix: string) => {
    const helpKey = key === "finalizedEmploymentRate" || key === "estimatedEmploymentRate" ? "employmentRates" : key;
    return <label data-help-key={helpKey} className="help-linked"><span className="field-label">{label}</span><div className="relative"><input className="field-input !pr-16 text-right" type="number" step="0.01" value={data[key]} onChange={(e) => update(key, Number(e.target.value))} /><span className="absolute right-3 top-3 text-xs text-[#748078]">{suffix}</span></div></label>;
  };
  return <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><section className="panel p-6 sm:p-8"><div className="flex items-center gap-3 border-b border-[#e8ece8] pb-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#fff2d8] text-[#936400]"><CircleDollarSign size={21} /></span><div><h2 className="font-semibold">保険料率と納付設定</h2><p className="mt-1 text-sm text-[#77837b]">申告書と公式の料率表を確認してください</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2">{rateInput("workersCompRate", "労災保険率", "/ 1,000")}{rateInput("finalizedEmploymentRate", "雇用保険率（確定）", "/ 1,000")}{rateInput("estimatedEmploymentRate", "雇用保険率（概算）", "/ 1,000")}{rateInput("generalContributionRate", "一般拠出金率", "/ 1,000")}<label><span className="field-label">申告済概算保険料額</span><input className="field-input text-right" type="number" value={data.alreadyPaidEstimatedPremium || ""} onChange={(e) => update("alreadyPaidEstimatedPremium", Number(e.target.value) || 0)} /></label><label><span className="field-label">納付回数</span><select className="field-input" value={data.installments} onChange={(e) => update("installments", Number(e.target.value) as 1 | 3)}><option value={1}>一括納付</option><option value={3} disabled={!result.canUseInstallments}>3回分納{!result.canUseInstallments ? `（${(result.installmentThreshold / 10_000).toLocaleString()}万円未満）` : ""}</option></select></label>{result.overpayment > 0 && <><label><span className="field-label">還付・充当の処理</span><select className="field-input" value={data.refundHandling} onChange={(e) => update("refundHandling", e.target.value as DeclarationInput["refundHandling"])}><option value="apply_then_refund">充当を優先（残額は還付）</option><option value="refund_all">充当しない（全額を還付）</option></select></label>{data.refundHandling === "apply_then_refund" && <label><span className="field-label">充当先</span><select className="field-input" value={data.allocationTarget} onChange={(e) => update("allocationTarget", e.target.value as DeclarationInput["allocationTarget"])}><option value="labor">労働保険料のみ</option><option value="contribution">一般拠出金のみ</option><option value="both">労働保険料及び一般拠出金</option></select></label>}</>}</div><div className="mt-6 rounded-2xl bg-[#fff9e9] p-4 text-sm leading-6 text-[#72591d]">Excel原本の設定：一般事業 14.5 / 13.5、農林水産・清酒製造 16.5 / 15.5、建設 17.5 / 16.5（確定 / 概算、千分率）。分納基準は一元40万円・二元20万円で、一般拠出金は第1期に全額加算します。</div></section><aside className="panel h-fit p-6"><p className="text-sm font-semibold text-[#6b786f]">現在の計算結果</p><div className="mt-5 space-y-4"><ResultLine label="確定保険料" value={result.finalizedPremium} /><ResultLine label="一般拠出金" value={result.generalContribution} /><ResultLine label="概算保険料" value={result.estimatedPremium} />{result.creditApplied > 0 && <ResultLine label="充当額" value={-result.creditApplied} />}{result.refundable > 0 && <ResultLine label="還付見込額" value={result.refundable} />}<div className="border-t border-[#e2e7e2] pt-4"><ResultLine label="納付見込額" value={result.payableTotal} strong /></div>{result.payableInstallmentAmounts.length > 1 && <div className="space-y-2 border-t border-[#e2e7e2] pt-4">{result.payableInstallmentAmounts.map((amount, index) => <ResultLine key={index} label={`第${index + 1}期`} value={amount} />)}</div>}</div></aside></div>;
}

function ReviewSection({ data, result, exportFile }: { data: DeclarationInput; result: ReturnType<typeof calculateDeclaration>; exportFile: (format: "excel" | "pdf") => void }) {
  return <div className="space-y-5">
    <section className="overflow-hidden rounded-3xl bg-[#174c3c] p-7 text-white shadow-xl sm:p-9">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div data-help-key="reviewPayment" className="help-linked rounded-xl"><p className="text-sm font-medium text-white/65">納付見込額</p><p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{formatYen(result.payableTotal)}</p></div>
          <p data-help-key="reviewBusiness" className="help-linked mt-3 rounded-lg text-sm text-white/65">{data.businessName || "事業名称未入力"} · {data.fiscalYear}年度</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"><Check size={16} />計算完了</span>
      </div>
    </section>
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section data-help-key="reviewWages" className="help-linked panel p-6 sm:p-8">
        <h2 data-help-key="reviewRates" className="help-linked rounded-lg font-semibold">保険料内訳</h2>
        <div className="mt-6 divide-y divide-[#e8ece8]"><ResultRow label="労災保険分（確定）" base={result.workersCompBase} value={result.finalizedWorkersComp} /><ResultRow label="雇用保険分（確定）" base={result.employmentBase} value={result.finalizedEmployment} /><ResultRow label="一般拠出金" base={result.workersCompBase} value={result.generalContribution} /><ResultRow label="概算保険料" base={result.workersCompBase + result.employmentBase} value={result.estimatedPremium} /><ResultRow label="申告済概算保険料" base={0} value={-data.alreadyPaidEstimatedPremium} /></div>
        {result.refundable > 0 && <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">還付見込額：{formatYen(result.refundable)}。別途、還付請求書が必要になる場合があります。</div>}
      </section>
      <aside data-help-key="reviewExport" className="help-linked panel p-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e9f3ea] text-[#28654d]"><Download size={20} /></span><div><h2 className="font-semibold">ファイル出力</h2><p className="text-sm text-[#7b867f]">1ファイルにつき1回分</p></div></div><div className="mt-6 space-y-3"><button className="button-secondary h-12 w-full !justify-between" onClick={() => exportFile("excel")}><span className="flex items-center gap-2"><FileSpreadsheet size={18} />Excelをダウンロード</span><LockKeyhole size={15} /></button><button className="button-secondary h-12 w-full !justify-between" onClick={() => exportFile("pdf")}><span className="flex items-center gap-2"><Download size={18} />PDFをダウンロード</span><LockKeyhole size={15} /></button></div><p className="mt-5 text-xs leading-5 text-[#849087]">登録時に無料出力回数が付与されます。使い切った後は必要な回数だけ追加購入できます。</p></aside>
    </div>
    <div className="rounded-2xl border border-[#eddca9] bg-[#fff9e9] p-4 text-sm leading-6 text-[#6c5722]">本ツールの計算結果は申告を支援するものです。提出前に公式の「年度更新申告書の書き方」と照合し、必要に応じて管轄の労働局へご確認ください。</div>
  </div>;
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) { return <div className="panel p-5"><p className="text-sm text-[#738078]">{title}</p><div className="mt-2 flex items-end justify-between"><strong className="text-2xl">{value}</strong><span className="text-xs text-[#849088]">{detail}</span></div></div>; }
function ResultLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className="flex items-center justify-between"><span className={cn("text-sm text-[#66736b]", strong && "font-semibold text-[#24352c]")}>{label}</span><span className={cn("font-semibold", strong && "text-xl text-[#174c3c]")}>{formatYen(value)}</span></div>; }
function ResultRow({ label, base, value }: { label: string; base: number; value: number }) { return <div className="grid grid-cols-[1fr_auto] gap-4 py-4"><div><p className="font-medium">{label}</p>{base > 0 && <p className="mt-1 text-xs text-[#849088]">算定基礎額 {formatYen(base)}</p>}</div><p className={cn("font-semibold", value < 0 && "text-blue-700")}>{value < 0 ? "−" : ""}{formatYen(Math.abs(value))}</p></div>; }

export function Paywall({ configured, loading, onCheckout, onClose }: { configured: boolean; loading: "month" | "year" | "portal" | null; onCheckout: (interval: "month" | "year") => void; onClose: () => void }) { return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#112019]/55 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl"><div className="flex justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-[#e8f3e9] text-[#216249]"><Sparkles size={23} /></span><button onClick={onClose}><X size={20} className="text-[#77837b]" /></button></div><h2 className="mt-6 text-2xl font-semibold tracking-tight">Proでファイル出力</h2><p className="mt-3 leading-7 text-[#68756d]">Excel・PDF出力とStripe請求書をご利用いただけます。料金はStripeに設定した月額・年額Priceを表示します。</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="button-secondary h-12" disabled={!configured || loading !== null} onClick={() => onCheckout("month")}>{loading === "month" && <LoaderCircle className="animate-spin" size={16} />}月額で始める</button><button className="button-primary h-12" disabled={!configured || loading !== null} onClick={() => onCheckout("year")}>{loading === "year" && <LoaderCircle className="animate-spin" size={16} />}年額で始める</button></div><p className="mt-3 text-center text-xs text-[#8a948d]">{configured ? "安全なStripe Checkoutへ移動します" : "管理者によるStripeテスト設定が必要です"}</p></div></div>; }
