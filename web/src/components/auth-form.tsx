"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

const authSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email("正しいメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

type AuthValues = z.infer<typeof authSchema>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: AuthValues) => {
    setServerError("");
    const result = mode === "register"
      ? await authClient.signUp.email({
          name: values.name?.trim() || values.email.split("@")[0],
          email: values.email,
          password: values.password,
        })
      : await authClient.signIn.email({ email: values.email, password: values.password });

    if (result.error) {
      setServerError(result.error.message || "処理に失敗しました。もう一度お試しください。");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {mode === "register" && (
        <label className="block">
          <span className="field-label">お名前</span>
          <input className="field-input" autoComplete="name" placeholder="山田 太郎" {...register("name")} />
        </label>
      )}
      <label className="block">
        <span className="field-label">メールアドレス</span>
        <input className="field-input" type="email" autoComplete="email" placeholder="name@example.jp" {...register("email")} />
        {errors.email && <span className="mt-1.5 block text-xs text-red-600">{errors.email.message}</span>}
      </label>
      <label className="block">
        <span className="field-label">パスワード</span>
        <input className="field-input" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="8文字以上" {...register("password")} />
        {errors.password && <span className="mt-1.5 block text-xs text-red-600">{errors.password.message}</span>}
      </label>
      {serverError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}
      <button className="button-primary h-12 w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : <>{mode === "register" ? "無料アカウントを作成" : "ログイン"}<ArrowRight size={17} /></>}
      </button>
    </form>
  );
}
