import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { createEmptyDeclaration } from "@/domain/declaration";
import { createExcelExport, createPdfExport } from "./exporters";

describe("paid exporters", () => {
  const input = createEmptyDeclaration();
  input.businessName = "テスト事業所";
  input.months[0].regularWorkers = 3;
  input.months[0].regularWages = 1_200_000;

  it("fills the official template workbook", async () => {
    const output = await createExcelExport(input);
    expect(Buffer.from(output).subarray(0, 2).toString()).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output);
    const main = workbook.getWorksheet("算定基礎賃金集計表");
    expect(main).toBeDefined();
    expect(main?.getCell("O26").value).toBe(3);
    expect(main?.getCell("S26").value).toBe(1_200_000);
    expect(String(main?.getCell("BK6").value)).toBe("テスト事業所");

    const form = workbook.getWorksheet("申告書記入イメージ");
    expect(form?.getCell("BB67").value).toBe(3);
    expect(form?.getCell("CV105").value).toBe(1);

    const settings = workbook.getWorksheet("設定シート（非表示）");
    expect(settings?.getCell("C6").value).toBe(2026);
  });

  it(
    "creates a valid PDF payload containing Japanese text",
    async () => {
      const output = await createPdfExport(input);
      expect(output.subarray(0, 5).toString()).toBe("%PDF-");
      expect(output.length).toBeGreaterThan(5_000);
    },
    20_000,
  );
});
