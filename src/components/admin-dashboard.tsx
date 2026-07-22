"use client";

import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type AdminTab = "overview" | "users" | "declarations" | "exports" | "flags";

type FeatureFlagItem = { key: string; label: string; description: string; enabled: boolean };
type Viewer = {
  id: string;
  name: string;
  email: string;
  role: "support" | "admin";
};
type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "user" | "support" | "admin";
  banned: boolean;
  banReason: string | null;
  exportCredits: number | null;
  createdAt: string;
  updatedAt: string;
};
type DeclarationItem = {
  id: string;
  fiscalYear: number;
  businessName: string;
  status: "draft" | "completed";
  ownerName: string;
  ownerEmail: string;
  updatedAt: string;
};
type ExportItem = {
  id: string;
  format: "xlsx" | "pdf";
  declarationId: string | null;
  userName: string;
  userEmail: string;
  createdAt: string;
};
type Overview = {
  metrics: {
    users: number;
    usersWithCredits: number;
    declarations: number;
    exports: number;
    paidRevenue: number;
    monthlyRevenue: number;
    outstanding: number;
    failedInvoices: number;
    paidPurchases: number;
    purchasedCredits: number;
    usedCredits: number;
    availableCredits: number;
  };
  recentAudits: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    actorName: string;
    actorEmail: string;
    createdAt: string;
  }[];
};

const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "概要", icon: LayoutDashboard },
  { id: "users", label: "ユーザー", icon: Users },
  { id: "declarations", label: "申告データ", icon: FileSpreadsheet },
  { id: "exports", label: "出力ログ", icon: Download },
  { id: "flags", label: "機能スイッチ", icon: SlidersHorizontal },
];

export function AdminDashboard({ viewer }: { viewer: Viewer }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [declarations, setDeclarations] = useState<DeclarationItem[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagItem[]>([]);
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const responses = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/users"),
      fetch("/api/admin/declarations"),
      fetch("/api/admin/exports"),
      fetch("/api/admin/feature-flags"),
    ]);
    if (responses.some((response) => !response.ok)) {
      setNotice("管理データを読み込めませんでした");
      setLoading(false);
      return;
    }
    const [overviewData, usersData, declarationsData, exportsData, flagsData] =
      await Promise.all(responses.map((response) => response.json()));
    setOverview(overviewData as Overview);
    setUsers((usersData as { items: AdminUser[] }).items);
    setDeclarations(
      (declarationsData as { items: DeclarationItem[] }).items,
    );
    setExports((exportsData as { items: ExportItem[] }).items);
    setFeatureFlags((flagsData as { items: FeatureFlagItem[] }).items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((item) =>
      `${item.name} ${item.email}`.toLowerCase().includes(normalized),
    );
  }, [query, users]);

  const updateLocalUser = (
    id: string,
    patch: Partial<Pick<AdminUser, "role" | "emailVerified" | "banned">>,
  ) =>
    setUsers((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const saveUser = async (item: AdminUser) => {
    if (
      item.banned &&
      !window.confirm(`${item.email} を無効化し、すべてのログインセッションを終了しますか？`)
    ) {
      return;
    }
    setSavingUserId(item.id);
    setNotice("");
    const response = await fetch(`/api/admin/users/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: item.role,
        emailVerified: item.emailVerified,
        banned: item.banned,
      }),
    });
    if (response.ok) {
      setNotice(`${item.email} を更新しました`);
      await refresh();
    } else {
      const payload = (await response.json()) as { error?: string };
      setNotice(
        payload.error === "cannot_demote_self"
          ? "自分自身の管理者権限は解除できません"
          : payload.error === "cannot_disable_self"
            ? "自分自身のアカウントは無効化できません"
            : "ユーザーを更新できませんでした",
      );
    }
    setSavingUserId(null);
  };

  const toggleFlag = async (item: FeatureFlagItem) => {
    setSavingFlagKey(item.key);
    setNotice("");
    const response = await fetch("/api/admin/feature-flags", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: item.key, enabled: !item.enabled }),
    });
    if (response.ok) {
      setFeatureFlags((current) =>
        current.map((flag) =>
          flag.key === item.key ? { ...flag, enabled: !item.enabled } : flag,
        ),
      );
      setNotice(`「${item.label}」を${item.enabled ? "無効" : "有効"}にしました`);
    } else {
      setNotice("機能スイッチを更新できませんでした");
    }
    setSavingFlagKey(null);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f2] text-[#18231d]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#dfe5df] bg-[#132e25] p-4 text-white lg:flex lg:flex-col">
        <div className="flex h-12 items-center gap-3 px-2 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-white/10"><ShieldCheck size={19} /></span>管理コンソール</div>
        <nav className="mt-8 space-y-1">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition", tab === item.id ? "bg-white text-[#174c3c]" : "text-white/70 hover:bg-white/10 hover:text-white")}><Icon size={18} />{item.label}</button>; })}</nav>
        <div className="mt-auto space-y-3"><Link href="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/10"><ArrowLeft size={17} />ユーザー画面へ</Link><div className="rounded-2xl bg-white/10 p-3"><p className="truncate text-sm font-semibold">{viewer.name}</p><p className="truncate text-xs text-white/55">{viewer.email}</p><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase">{viewer.role}</span><button aria-label="ログアウト" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}><LogOut size={16} /></button></div></div></div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dfe5df] bg-white/95 px-4 backdrop-blur lg:ml-64 lg:px-8"><div className="flex items-center gap-3"><ShieldCheck className="text-[#25654c] lg:hidden" size={21} /><div><p className="font-semibold">{tabs.find((item) => item.id === tab)?.label}</p><p className="text-xs text-[#7d8981]">管理者専用</p></div></div><div className="flex items-center gap-3">{notice && <span className="hidden text-sm text-[#587066] sm:inline">{notice}</span>}<button className="button-secondary !px-3" onClick={() => void refresh()} disabled={loading}><RefreshCw className={cn(loading && "animate-spin")} size={17} />更新</button><Link href="/dashboard" className="button-ghost !px-2 lg:hidden"><ArrowLeft size={18} /></Link></div></header>
      <main className="p-4 pb-16 lg:ml-64 lg:p-8"><div className="mx-auto max-w-[1320px]"><div className="mb-5 flex gap-2 overflow-x-auto lg:hidden">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm", tab === item.id ? "bg-[#174c3c] text-white" : "bg-white text-[#5f6c64]")}><Icon size={16} />{item.label}</button>; })}</div>{loading && !overview ? <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-[#2c7357]" size={30} /></div> : <>{tab === "overview" && overview && <OverviewPanel data={overview} />}{tab === "users" && <UsersPanel users={filteredUsers} query={query} viewer={viewer} savingUserId={savingUserId} onQuery={setQuery} onChange={updateLocalUser} onSave={saveUser} />}{tab === "declarations" && <DeclarationsPanel items={declarations} />}{tab === "exports" && <ExportsPanel items={exports} />}{tab === "flags" && <FlagsPanel items={featureFlags} viewer={viewer} savingKey={savingFlagKey} onToggle={toggleFlag} />}</>}</div></main>
    </div>
  );
}

function OverviewPanel({ data }: { data: Overview }) {
  const serviceMetrics = [
    ["ユーザー", data.metrics.users],
    ["残高ありユーザー", data.metrics.usersWithCredits],
    ["申告データ", data.metrics.declarations],
    ["ファイル出力", data.metrics.exports],
  ] as const;
  const financialMetrics = [
    ["累計決済額", formatCurrency(data.metrics.paidRevenue)],
    ["今月の決済額", formatCurrency(data.metrics.monthlyRevenue)],
    ["購入済み回数", data.metrics.purchasedCredits.toLocaleString()],
    ["未収金額", formatCurrency(data.metrics.outstanding)],
    ["購入件数", data.metrics.paidPurchases.toLocaleString()],
    ["使用済み回数", data.metrics.usedCredits.toLocaleString()],
    ["利用可能回数", data.metrics.availableCredits.toLocaleString()],
    ["支払失敗請求", data.metrics.failedInvoices.toLocaleString()],
  ] as const;
  return <div><div className="mb-7"><p className="text-sm font-semibold text-[#2e765a]">ADMIN OVERVIEW</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">サービス概要</h1></div><section><div className="mb-3 flex items-end justify-between"><div><h2 className="font-semibold">売上・請求</h2><p className="mt-1 text-xs text-[#7b867f]">Stripe Webhookで同期したJPY実績</p></div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{financialMetrics.map(([label, value]) => <div key={label} className="panel p-6"><p className="text-sm text-[#738078]">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div></section><section className="mt-7"><h2 className="mb-3 font-semibold">利用状況</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{serviceMetrics.map(([label, value]) => <div key={label} className="panel p-6"><p className="text-sm text-[#738078]">{label}</p><p className="mt-3 text-3xl font-semibold">{value.toLocaleString()}</p></div>)}</div></section><section className="panel mt-5 overflow-hidden"><div className="border-b border-[#e5eae5] px-6 py-5"><h2 className="font-semibold">最近の管理操作</h2></div>{data.recentAudits.length === 0 ? <p className="p-6 text-sm text-[#7b867f]">管理操作はまだ記録されていません。</p> : <div className="divide-y divide-[#e8ece8]">{data.recentAudits.map((item) => <div key={item.id} className="grid gap-1 px-6 py-4 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-medium">{item.action}</p><p className="mt-1 text-xs text-[#7b867f]">{item.actorName} · {item.actorEmail} → {item.targetType}:{item.targetId}</p></div><time className="text-xs text-[#8a948d]">{formatDate(item.createdAt)}</time></div>)}</div>}</section></div>;
}

function UsersPanel({ users, query, viewer, savingUserId, onQuery, onChange, onSave }: { users: AdminUser[]; query: string; viewer: Viewer; savingUserId: string | null; onQuery: (value: string) => void; onChange: (id: string, patch: Partial<Pick<AdminUser, "role" | "emailVerified" | "banned">>) => void; onSave: (item: AdminUser) => void }) {
  const readOnly = viewer.role !== "admin";
  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#2e765a]">ACCESS CONTROL</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">ユーザー管理</h1>
          <p className="mt-2 text-[#6c7870]">{readOnly ? "support権限では閲覧のみ可能です。" : "アカウント状態、メール確認、ロールを管理します。"}</p>
        </div>
        <input className="field-input max-w-sm" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="名前・メールで検索" />
      </div>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-[#f4f6f2] text-left text-xs text-[#66736b]">
            <tr><th className="px-5 py-3">ユーザー</th><th className="px-4 py-3">登録日</th><th className="px-4 py-3">状態</th><th className="px-4 py-3">メール確認</th><th className="px-4 py-3">ロール</th><th className="px-4 py-3">残り回数</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-[#e8ece8]">
            {users.map((item) => {
              const self = item.id === viewer.id;
              return (
                <tr key={item.id} className={cn(item.banned && "bg-red-50/40")}>
                  <td className="px-5 py-4"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-[#7b867f]">{item.email}</p>{item.banReason && <p className="mt-1 text-xs text-red-600">{item.banReason}</p>}</td>
                  <td className="px-4 py-4 text-[#66736b]">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-4"><select className="field-input !h-9 !py-1" value={item.banned ? "disabled" : "active"} disabled={readOnly || self} onChange={(event) => onChange(item.id, { banned: event.target.value === "disabled" })}><option value="active">有効</option><option value="disabled">無効</option></select></td>
                  <td className="px-4 py-4"><select className="field-input !h-9 !py-1" value={item.emailVerified ? "verified" : "unverified"} disabled={readOnly} onChange={(event) => onChange(item.id, { emailVerified: event.target.value === "verified" })}><option value="verified">確認済み</option><option value="unverified">未確認</option></select></td>
                  <td className="px-4 py-4"><select className="field-input !h-9 !py-1" value={item.role} disabled={readOnly || self} onChange={(event) => onChange(item.id, { role: event.target.value as AdminUser["role"] })}><option value="user">user</option><option value="support">support</option><option value="admin">admin</option></select></td>
                  <td className="px-4 py-4 font-semibold">{(item.exportCredits ?? 0).toLocaleString()} 回</td>
                  <td className="px-4 py-4"><button className="button-secondary !px-3" disabled={readOnly || savingUserId === item.id} onClick={() => onSave(item)}>{savingUserId === item.id ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />}保存</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FlagsPanel({ items, viewer, savingKey, onToggle }: { items: FeatureFlagItem[]; viewer: Viewer; savingKey: string | null; onToggle: (item: FeatureFlagItem) => void }) {
  const readOnly = viewer.role !== "admin";
  return <div><div className="mb-7"><p className="text-sm font-semibold text-[#2e765a]">FEATURE FLAGS</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">機能スイッチ</h1><p className="mt-2 text-[#6c7870]">OFF の機能はユーザー画面から非表示になります（準備中の機能を公開前に隠せます）。{readOnly && "サポート権限では閲覧のみ可能です。"}</p></div><section className="panel divide-y divide-[#e8ece8]">{items.map((item) => <div key={item.key} className="flex items-center justify-between gap-4 px-6 py-5"><div><p className="font-semibold">{item.label}</p><p className="mt-1 text-sm text-[#77837b]">{item.description}</p></div><button type="button" role="switch" aria-checked={item.enabled} disabled={readOnly || savingKey !== null} onClick={() => onToggle(item)} className={cn("relative h-7 w-13 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60", item.enabled ? "bg-[#174c3c]" : "bg-[#ccd6cf]")}><span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white shadow transition-all", item.enabled ? "left-[26px]" : "left-0.5")}>{savingKey === item.key && <LoaderCircle className="animate-spin text-[#2c7357]" size={13} />}</span></button></div>)}</section></div>;
}

function DeclarationsPanel({ items }: { items: DeclarationItem[] }) {
  return <AdminTable title="申告データ" description="個人情報を最小化し、申告内容そのものは表示しません。" headers={["事業・年度", "所有者", "状態", "最終更新"]} rows={items.map((item) => [<span key="business"><strong>{item.businessName || "名称未入力"}</strong><small>{item.fiscalYear}年度</small></span>, <span key="owner">{item.ownerName}<small>{item.ownerEmail}</small></span>, item.status === "draft" ? "下書き" : "完了", formatDate(item.updatedAt)])} />;
}

function ExportsPanel({ items }: { items: ExportItem[] }) {
  return <AdminTable title="出力ログ" description="有料出力の監査用ログです。" headers={["形式", "ユーザー", "申告ID", "出力日時"]} rows={items.map((item) => [item.format.toUpperCase(), <span key="user">{item.userName}<small>{item.userEmail}</small></span>, item.declarationId || "—", formatDate(item.createdAt)])} />;
}

function AdminTable({ title, description, headers, rows }: { title: string; description: string; headers: string[]; rows: React.ReactNode[][] }) {
  return <div><div className="mb-7"><p className="text-sm font-semibold text-[#2e765a]">AUDIT DATA</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">{title}</h1><p className="mt-2 text-[#6c7870]">{description}</p></div><section className="panel overflow-x-auto">{rows.length === 0 ? <p className="p-8 text-center text-sm text-[#7b867f]">データはまだありません。</p> : <table className="w-full min-w-[760px] text-sm"><thead className="bg-[#f4f6f2] text-left text-xs text-[#66736b]"><tr>{headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#e8ece8]">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-4 [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-[#7b867f]">{cell}</td>)}</tr>)}</tbody></table>}</section></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}
