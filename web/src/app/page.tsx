import {
  ArrowRight,
  BadgeCheck,
  Bot,
  FileDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Sparkles,
    title: "迷わない入力フロー",
    body: "複雑な集計表を、事業情報・月別賃金・料率・確認の4ステップに整理しました。",
  },
  {
    icon: ShieldCheck,
    title: "計算根拠を見える化",
    body: "労災・雇用保険・一般拠出金を分けて表示し、転記前に数字を確認できます。",
  },
  {
    icon: FileDown,
    title: "Excel・PDF出力",
    body: "完成した申告データを保存し、Proプランで保管用ファイルを出力できます。",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f3] text-[#16211b]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="grid size-10 place-items-center rounded-xl bg-[#174c3c] text-white">
            年
          </span>
          <span>年度更新ナビ</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link className="button-ghost hidden sm:inline-flex" href="/login">
            ログイン
          </Link>
          <Link className="button-primary" href="/register">
            無料で始める <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.02fr_.98fr] lg:px-10 lg:pb-28 lg:pt-24">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#cdd9d1] bg-white/80 px-4 py-2 text-sm font-medium text-[#28624f] shadow-sm">
            <BadgeCheck size={16} /> 令和8年度の料率設定に対応する設計
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            年度更新を、
            <span className="text-[#2c7a5d]">もっと静かに。</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#5e6d64]">
            労働保険の賃金集計から申告額の確認まで。Excelの複雑さを、わかりやすいWebフォームに置き換えます。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="button-primary h-12 px-6" href="/register">
              申告書を作成する <ArrowRight size={18} />
            </Link>
            <a className="button-secondary h-12 px-6" href="#features">
              機能を見る
            </a>
          </div>
          <p className="mt-5 text-sm text-[#758178]">登録無料 · クレジットカード不要</p>
        </div>

        <div className="relative min-h-[470px]">
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-[#dcebd4] blur-3xl" />
          <div className="relative rotate-[1.5deg] rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_30px_80px_rgba(31,62,45,.16)]">
            <div className="flex items-center justify-between border-b border-[#e8ece8] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#7e8c83]">2026 annual renewal</p>
                <p className="mt-1 font-semibold">確定保険料 算定基礎</p>
              </div>
              <span className="rounded-full bg-[#edf7ef] px-3 py-1 text-xs font-semibold text-[#27704f]">自動保存</span>
            </div>
            <div className="grid grid-cols-3 gap-3 py-5">
              {["労災保険", "雇用保険", "一般拠出金"].map((label, index) => (
                <div key={label} className="rounded-2xl bg-[#f5f7f3] p-4">
                  <p className="text-xs text-[#758178]">{label}</p>
                  <p className="mt-5 text-lg font-semibold">{["¥428,760", "¥1,841,200", "¥2,858"][index]}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#e5eae5]">
              <div className="grid grid-cols-[.55fr_1fr_1fr] bg-[#f0f4ef] px-4 py-3 text-xs font-semibold text-[#657168]">
                <span>月</span><span>対象者</span><span>賃金総額</span>
              </div>
              {["4月", "5月", "6月", "7月"].map((month, index) => (
                <div key={month} className="grid grid-cols-[.55fr_1fr_1fr] border-t border-[#edf0ed] px-4 py-3 text-sm">
                  <span className="font-medium">{month}</span><span>{12 + index} 人</span><span>¥{(3_240_000 + index * 180_000).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#174c3c] p-5 text-white">
              <span className="text-sm text-white/70">納付見込額</span>
              <strong className="text-2xl">¥2,118,420</strong>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-8 flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl">
            <span className="grid size-9 place-items-center rounded-xl bg-[#fff3d4] text-[#9a6a00]"><Bot size={18} /></span>
            <div><p className="text-xs text-[#7b877f]">入力アシスト</p><p className="text-sm font-semibold">異常値はありません</p></div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-[#dfe5df] bg-white/60">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-3 lg:px-10">
          {features.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-3xl border border-[#e1e7e1] bg-white p-7 shadow-[0_12px_40px_rgba(32,58,43,.05)]">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#e9f3ea] text-[#27624c]"><Icon size={21} /></span>
              <h2 className="mt-6 text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-[#66736b]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-10 text-sm text-[#758178] sm:flex-row lg:px-10">
        <p>© 2026 年度更新ナビ</p>
        <p>本サービスは計算支援ツールです。提出前に必ず内容をご確認ください。</p>
      </footer>
    </main>
  );
}
