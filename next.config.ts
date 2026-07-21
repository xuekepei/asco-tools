import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit は同梱の AFM フォントデータを実行時に fs で読むため、
  // バンドルすると ENOENT になる。exceljs も同様に外部化する。
  serverExternalPackages: ["pdfkit", "exceljs"],
  // PDF 导出在运行时读取该字体文件，standalone 追踪不到 fs 路径拼接，需显式包含
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "./node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-{400,700}-normal.woff",
    ],
  },
};

export default nextConfig;
