import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { createEmptyDeclaration } from "@/domain/declaration";
import { createExcelExport, createPdfExport } from "./exporters";

describe("paid exporters", () => {
  const input = createEmptyDeclaration();
  input.businessName = "テスト事業所";
  input.months[0].regularWorkers = 3;
  input.months[0].regularWages = 1_200_000;

  it("creates a valid xlsx payload", async () => {
    const output = await createExcelExport(input);
    expect(Buffer.from(output).subarray(0, 2).toString()).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output);
    expect(workbook.getWorksheet("月別賃金集計")?.rowCount).toBe(16);
    expect(workbook.getWorksheet("役員詳細")?.rowCount).toBe(6);
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
