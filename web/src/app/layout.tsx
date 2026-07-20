import type { Metadata } from "next";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "年度更新ナビ | 労働保険申告をシンプルに",
  description: "労働保険の年度更新申告に必要な賃金集計と保険料計算を支援します。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
