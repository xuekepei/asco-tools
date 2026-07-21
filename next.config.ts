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
    // Excel 导出以厚労省原本为模板，运行时从磁盘读取
    "/api/export/excel": ["./docs/001679511(3).xlsx"],
  },
};

export default nextConfig;
