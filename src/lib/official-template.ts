import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import type { DeclarationInput } from "@/domain/declaration";

/**
 * 厚生労働省「年度更新申告書計算支援ツール」の原本（docs/001679511(3).xlsx）に
 * 申告データを書き込んで返す。ExcelJS は本ファイルの読み書き往復で壊れるため、
 * xlsx(ZIP) 内のシート XML を直接編集する。数式には触れず入力セルだけを埋め、
 * fullCalcOnLoad で Excel が開いた時に全数式を再計算させる。
 */

const TEMPLATE_PATH = "docs/001679511(3).xlsx";
const SHEET_MAIN = "算定基礎賃金集計表";
const SHEET_FORM = "申告書記入イメージ";
const SHEET_SETTINGS = "設定シート（非表示）";

type CellWrite = { addr: string; value: number | string };

const WAGE_COLUMNS = [
  ["O", "regularWorkers"],
  ["S", "regularWages"],
  ["AB", "officerWorkers"],
  ["AF", "officerWages"],
  ["AO", "temporaryWorkers"],
  ["AS", "temporaryWages"],
  ["BO", "insuredWorkers"],
  ["BS", "insuredWages"],
  ["CB", "insuredOfficerWorkers"],
  ["CF", "insuredOfficerWages"],
] as const;

const MONTH_FIRST_ROW = 26; // 4月。以降 2 行おきに 3月（48 行）まで
const BONUS_FIRST_ROW = 50; // 賞与1〜3 も 2 行おき
const OFFICER_FIRST_ROW = 78; // 備考「役員で労働者扱いの詳細」5 行

// 労働保険番号の桁別ボックス（都道府県2・所掌1・管轄2・基幹6・枝番3）
const INSURANCE_NUMBER_CELLS = [
  ["O9", "Q9"],
  ["S9"],
  ["U9", "W9"],
  ["Y9", "AA9", "AC9", "AE9", "AG9", "AI9"],
  ["AK9", "AM9", "AO9"],
] as const;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnToNumber(column: string) {
  let result = 0;
  for (const char of column) result = result * 26 + (char.charCodeAt(0) - 64);
  return result;
}

function parseAddress(addr: string) {
  const match = addr.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`invalid cell address: ${addr}`);
  return { column: match[1], row: Number(match[2]) };
}

function buildCellXml(addr: string, styleAttr: string, value: number | string) {
  if (typeof value === "number") {
    return `<c r="${addr}"${styleAttr}><v>${value}</v></c>`;
  }
  return `<c r="${addr}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** 行 XML の中へセルを列順を保って upsert する */
function upsertCellInRow(rowXml: string, addr: string, value: number | string) {
  const cellRe = new RegExp(`<c r="${addr}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const existing = rowXml.match(cellRe);
  if (existing) {
    const style = existing[1].match(/ s="\d+"/);
    return rowXml.replace(cellRe, buildCellXml(addr, style ? style[0] : "", value));
  }
  const target = columnToNumber(parseAddress(addr).column);
  const cellXml = buildCellXml(addr, "", value);
  const cellsRe = /<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  let match: RegExpExecArray | null;
  while ((match = cellsRe.exec(rowXml)) !== null) {
    if (columnToNumber(match[1]) > target) {
      return rowXml.slice(0, match.index) + cellXml + rowXml.slice(match.index);
    }
  }
  if (rowXml.endsWith("/>")) {
    return rowXml.slice(0, -2).replace(/ ?$/, "") + `>${cellXml}</row>`;
  }
  return rowXml.replace(/<\/row>$/, `${cellXml}</row>`);
}

function setCells(sheetXml: string, writes: CellWrite[]) {
  let xml = sheetXml;
  for (const { addr, value } of writes) {
    const { row } = parseAddress(addr);
    const rowRe = new RegExp(`<row r="${row}"(?:[^>]*?/>|[^>]*?>[\\s\\S]*?</row>)`);
    const rowMatch = xml.match(rowRe);
    if (!rowMatch) throw new Error(`row ${row} not found in template sheet`);
    xml = xml.replace(rowRe, upsertCellInRow(rowMatch[0], addr, value));
  }
  return xml;
}

/** workbook.xml の sheet 名 → sheetN.xml パスを解決する */
function resolveSheetFiles(workbookXml: string, relsXml: string) {
  const rels = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
    rels.set(match[1], match[2]);
  }
  const files = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    const target = rels.get(match[2]);
    if (target) files.set(match[1], `xl/${target.replace(/^\//, "").replace(/^xl\//, "")}`);
  }
  return files;
}

function collectMainSheetWrites(input: DeclarationInput) {
  const writes: CellWrite[] = [];

  const digits = input.laborInsuranceNumber.replace(/\D/g, "");
  let cursor = 0;
  for (const group of INSURANCE_NUMBER_CELLS) {
    for (const cell of group) {
      if (cursor >= digits.length) break;
      writes.push({ addr: cell, value: Number(digits[cursor]) });
      cursor += 1;
    }
  }

  if (input.businessName) writes.push({ addr: "BK6", value: input.businessName });
  if (input.phone) writes.push({ addr: "CE6", value: input.phone });
  if (input.address) writes.push({ addr: "BM10", value: input.address });
  const postal = input.postalCode.replace(/\D/g, "");
  if (postal.length >= 3) {
    writes.push({ addr: "CG10", value: postal.slice(0, 3) });
    if (postal.length > 3) writes.push({ addr: "CN10", value: postal.slice(3, 7) });
  }
  if (input.workDescription) writes.push({ addr: "CS9", value: input.workDescription });
  if (input.incomingSecondedWorkers > 0) writes.push({ addr: "AU8", value: input.incomingSecondedWorkers });
  if (input.outgoingSecondedWorkers > 0) writes.push({ addr: "AU11", value: input.outgoingSecondedWorkers });

  input.months.forEach((month, index) => {
    const row = MONTH_FIRST_ROW + index * 2;
    for (const [column, key] of WAGE_COLUMNS) {
      const value = month[key];
      if (typeof value === "number" && value !== 0) writes.push({ addr: `${column}${row}`, value });
    }
  });
  input.bonusEntries.forEach((bonus, index) => {
    const row = BONUS_FIRST_ROW + index * 2;
    for (const [column, key] of WAGE_COLUMNS) {
      const value = bonus[key];
      if (typeof value === "number" && value !== 0) writes.push({ addr: `${column}${row}`, value });
    }
  });

  input.officerDetails.forEach((officer, index) => {
    if (!officer.name) return;
    const row = OFFICER_FIRST_ROW + index;
    writes.push({ addr: `S${row}`, value: officer.name });
    if (officer.position) writes.push({ addr: `AB${row}`, value: officer.position });
    writes.push({ addr: `AJ${row}`, value: officer.employmentInsured ? "有" : "無" });
  });

  return writes;
}

function collectFormSheetWrites(input: DeclarationInput) {
  const writes: CellWrite[] = [
    { addr: "BB67", value: input.workersCompRate },
    { addr: "BB72", value: input.finalizedEmploymentRate },
    { addr: "BB94", value: input.workersCompRate },
    { addr: "BB99", value: input.estimatedEmploymentRate },
    { addr: "CV105", value: input.installments },
  ];
  if (input.alreadyPaidEstimatedPremium > 0) {
    writes.push({ addr: "AF117", value: input.alreadyPaidEstimatedPremium });
  }
  writes.push({
    addr: "CD129",
    value: input.refundHandling === "apply_then_refund" ? "充当を優先（残額は還付）" : "充当しない（全額を還付）",
  });
  if (input.refundHandling === "apply_then_refund") {
    const intent = { labor: 1, contribution: 2, both: 3 }[input.allocationTarget];
    writes.push({ addr: "AY124", value: intent });
  }
  return writes;
}

export async function fillOfficialTemplate(input: DeclarationInput) {
  const template = await readFile(path.join(process.cwd(), TEMPLATE_PATH));
  const zip = await JSZip.loadAsync(template);

  const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const sheetFiles = resolveSheetFiles(workbookXml, relsXml);

  const edits: [string, CellWrite[]][] = [
    [SHEET_MAIN, collectMainSheetWrites(input)],
    [SHEET_FORM, collectFormSheetWrites(input)],
    [SHEET_SETTINGS, [{ addr: "C6", value: input.fiscalYear }]],
  ];
  for (const [sheetName, writes] of edits) {
    const file = sheetFiles.get(sheetName);
    if (!file) throw new Error(`sheet not found in template: ${sheetName}`);
    const xml = await zip.file(file)!.async("string");
    zip.file(file, setCells(xml, writes));
  }

  // 開いた時に全数式を再計算させる（入力セルだけ書き換えるため）
  const withRecalc = workbookXml.includes("<calcPr")
    ? workbookXml.replace(/<calcPr([^>]*?)\/>/, (m, attrs: string) =>
        attrs.includes("fullCalcOnLoad") ? m : `<calcPr${attrs} fullCalcOnLoad="1"/>`)
    : workbookXml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  zip.file("xl/workbook.xml", withRecalc);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
