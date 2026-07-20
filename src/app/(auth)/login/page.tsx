import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return <div className="w-full max-w-md"><Link href="/" className="mb-10 inline-flex items-center gap-2 font-semibold text-[#174c3c]">← 年度更新ナビ</Link><p className="text-sm font-semibold text-[#2c7458]">WELCOME BACK</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">おかえりなさい</h1><p className="mt-3 text-[#68756d]">保存した申告書の続きを始めましょう。</p><AuthForm mode="login" /><p className="mt-6 text-center text-sm text-[#6e7a72]">アカウントをお持ちでない方は <Link className="font-semibold text-[#21634b]" href="/register">無料登録</Link></p></div>;
}
