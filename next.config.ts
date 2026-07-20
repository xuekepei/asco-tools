import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PDF 导出在运行时读取该字体文件，standalone 追踪不到 fs 路径拼接，需显式包含
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "./node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff",
    ],
  },
};

export default nextConfig;
