import { BadgeCheck } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f7f8f3] lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-12">{children}</section>
      <aside className="relative hidden overflow-hidden bg-[#174c3c] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-[#398366]/40 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-3 font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-white text-[#174c3c]">年</span>年度更新ナビ</Link>
        <div className="relative max-w-xl">
          <p className="text-4xl font-semibold leading-tight tracking-[-.035em]">Excelの計算力はそのままに、入力体験をシンプルに。</p>
          <div className="mt-10 space-y-4 text-white/80">
            {["12か月分の賃金を見やすく集計", "保険料と納付額をリアルタイム計算", "下書きを安全に保存していつでも再開"].map((item) => <p key={item} className="flex items-center gap-3"><BadgeCheck size={19} className="text-[#a9dab8]" />{item}</p>)}
          </div>
        </div>
        <p className="relative text-sm text-white/50">申告前には必ず公式資料と照合してください。</p>
      </aside>
    </main>
  );
}
