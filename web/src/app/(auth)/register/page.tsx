import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <div className="w-full max-w-md"><Link href="/" className="mb-10 inline-flex items-center gap-2 font-semibold text-[#174c3c]">← 年度更新ナビ</Link><p className="text-sm font-semibold text-[#2c7458]">GET STARTED</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">無料アカウントを作成</h1><p className="mt-3 text-[#68756d]">まずは下書き保存まで、無料でお試しいただけます。</p><AuthForm mode="register" /><p className="mt-6 text-center text-sm text-[#6e7a72]">すでにアカウントをお持ちですか？ <Link className="font-semibold text-[#21634b]" href="/login">ログイン</Link></p></div>;
}
