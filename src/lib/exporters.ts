import path from "node:path";

import PDFDocument from "pdfkit";

import {
  calculateDeclaration,
  type DeclarationInput,
} from "@/domain/declaration";
import { fillOfficialTemplate } from "@/lib/official-template";

/** 厚労省の原本 Excel に申告データを書き込んだブックを返す */
export async function createExcelExport(input: DeclarationInput) {
  return fillOfficialTemplate(input);
}

export async function createPdfExport(input: DeclarationInput) {
  const result = calculateDeclaration(input);
  const document = new PDFDocument({ size: "A4", margin: 46, info: { Title: "年度更新 計算結果" } });
  const chunks: Buffer[] = [];
  document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const fontDir = path.join(process.cwd(), "node_modules/@fontsource/noto-sans-jp/files");
  document.registerFont("NotoJP", path.join(fontDir, "noto-sans-jp-japanese-400-normal.woff"));
  document.registerFont("NotoJP-Bold", path.join(fontDir, "noto-sans-jp-japanese-700-normal.woff"));
  document.font("NotoJP-Bold").fillColor("#174c3c").fontSize(21).text("年度更新 計算結果");
  document.font("NotoJP");
  document.moveDown(0.5).fillColor("#5d6c63").fontSize(10).text(`${input.fiscalYear}年度　${input.businessName}`);
  const generatedAt = new Date().toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
  document.moveDown(0.3).fontSize(9).text(`労働保険番号 ${input.laborInsuranceNumber || "未入力"}　／　出力日時 ${generatedAt}`);
  document.moveDown(1.3);

  const rows: [string, number][] = [
    ["労災保険 算定基礎額", result.workersCompBase],
    ["雇用保険 算定基礎額", result.employmentBase],
    ["確定保険料", result.finalizedPremium],
    ["一般拠出金", result.generalContribution],
    ["概算保険料", result.estimatedPremium],
    ["申告済概算保険料", input.alreadyPaidEstimatedPremium],
    ["不足額", result.shortfall],
    ["充当額", result.creditApplied],
    ["納付見込額", result.payableTotal],
    ["還付見込額", result.refundable],
    ...result.payableInstallmentAmounts.map(
      (value, index) => [`第${index + 1}期納付額`, value] as [string, number],
    ),
  ];
  rows.forEach(([label, value], index) => {
    const emphasized = label === "納付見込額" || (label === "還付見込額" && value > 0);
    const y = document.y;
    if (index % 2 === 0) document.rect(46, y - 5, 503, 25).fill("#f2f5f1");
    document.font(emphasized ? "NotoJP-Bold" : "NotoJP");
    document.fillColor(emphasized ? "#174c3c" : "#28372f").fontSize(10).text(label, 56, y, { width: 290 });
    document.text(`${value.toLocaleString("ja-JP")} 円`, 355, y, { width: 180, align: "right" });
    document.y = y + 26;
  });
  document.font("NotoJP").moveDown(1.5);
  document.fillColor("#7a867e").fontSize(8).text(
    "本書は計算支援用です。提出前に公式資料と照合し、計算結果をご確認ください。",
    46,
    document.y,
    { width: 503 },
  );
  document.end();
  return completed;
}
