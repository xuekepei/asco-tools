import path from "node:path";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import {
  calculateDeclaration,
  type DeclarationInput,
} from "@/domain/declaration";

export async function createExcelExport(input: DeclarationInput) {
  const result = calculateDeclaration(input);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "年度更新ナビ";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("計算結果");
  summary.columns = [
    { header: "項目", key: "label", width: 34 },
    { header: "金額（円）", key: "value", width: 20 },
  ];
  summary.addRows([
    { label: "事業名称", value: input.businessName },
    { label: "対象年度", value: input.fiscalYear },
    { label: "労働保険番号", value: input.laborInsuranceNumber },
    { label: "所在地", value: input.address },
    { label: "郵便番号", value: input.postalCode },
    { label: "電話番号", value: input.phone },
    { label: "具体的な業務又は作業の内容", value: input.workDescription },
    { label: "出向者（受入）", value: input.incomingSecondedWorkers },
    { label: "出向者（送出）", value: input.outgoingSecondedWorkers },
    { label: "常時使用労働者数（月平均）", value: result.averageWorkers },
    { label: "雇用保険被保険者数（月平均）", value: result.averageEmploymentInsured },
    { label: "労災保険 算定基礎額", value: result.workersCompBase },
    { label: "雇用保険 算定基礎額", value: result.employmentBase },
    { label: "労災保険率（千分率）", value: input.workersCompRate },
    { label: "雇用保険率・確定（千分率）", value: input.finalizedEmploymentRate },
    { label: "雇用保険率・概算（千分率）", value: input.estimatedEmploymentRate },
    { label: "一般拠出金率（千分率）", value: input.generalContributionRate },
    { label: "確定保険料", value: result.finalizedPremium },
    { label: "一般拠出金", value: result.generalContribution },
    { label: "概算保険料", value: result.estimatedPremium },
    { label: "申告済概算保険料", value: input.alreadyPaidEstimatedPremium },
    { label: "不足額", value: result.shortfall },
    { label: "充当額", value: result.creditApplied },
    { label: "納付見込額", value: result.payableTotal },
    { label: "還付見込額", value: result.refundable },
    ...result.payableInstallmentAmounts.map((value, index) => ({
      label: `第${index + 1}期納付額`,
      value,
    })),
  ]);
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174C3C" } };
  summary.getColumn(2).numFmt = "#,##0";

  const wages = workbook.addWorksheet("月別賃金集計");
  wages.columns = [
    { header: "月", key: "month", width: 10 },
    { header: "常用人数", key: "regularWorkers", width: 12 },
    { header: "常用賃金", key: "regularWages", width: 16 },
    { header: "役員人数", key: "officerWorkers", width: 12 },
    { header: "役員賃金", key: "officerWages", width: 16 },
    { header: "臨時人数", key: "temporaryWorkers", width: 12 },
    { header: "臨時賃金", key: "temporaryWages", width: 16 },
    { header: "雇用被保険者数", key: "insuredWorkers", width: 16 },
    { header: "雇用対象賃金", key: "insuredWages", width: 18 },
    { header: "役員(雇用)人数", key: "insuredOfficerWorkers", width: 16 },
    { header: "役員(雇用)賃金", key: "insuredOfficerWages", width: 18 },
  ];
  wages.addRows([...input.months, ...input.bonusEntries]);
  wages.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wages.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C7357" } };
  for (let column = 2; column <= 11; column += 1) wages.getColumn(column).numFmt = "#,##0";
  wages.views = [{ state: "frozen", ySplit: 1 }];

  const officers = workbook.addWorksheet("役員詳細");
  officers.columns = [
    { header: "氏名", key: "name", width: 24 },
    { header: "役職", key: "position", width: 24 },
    { header: "雇用保険資格", key: "employmentInsured", width: 18 },
  ];
  officers.addRows(
    input.officerDetails.map((officer) => ({
      ...officer,
      employmentInsured: officer.employmentInsured ? "有" : "無",
    })),
  );
  officers.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  officers.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C7357" } };

  return workbook.xlsx.writeBuffer();
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
