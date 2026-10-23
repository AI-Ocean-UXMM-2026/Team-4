import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const folder = path.join(root, "outputs/cash-balances-template-20261022");
await fs.mkdir(folder, {recursive: true});
const sources = [
  ["C:/Users/Thiri/Downloads/0c009beb-8c8b-4445-a898-da7ab6661980-template(2).xlsx", "Mi-Thar-Su-template-with-cash-balances.xlsx"],
  [path.join(root, "shared/workbook-template/bizflow-template.xlsx"), "bizflow-template.xlsx"],
];
for (const [source, filename] of sources) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
  const sheet = workbook.worksheets.add("CashBalances");
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A1:E1").values = [["balance_id", "business_id", "as_of_date", "cash_on_hand_mmk", "bank_balance_mmk"]];
  sheet.getRange("A1:E1").format = {fill: "#244B45", font: {name: "Arial", size: 10, bold: true, color: "#FFFFFF"}, rowHeight: 30};
  sheet.getRange("A1:E21").format.columnWidth = 26;
  sheet.getRange("B1:B21").format.columnWidth = 46;
  sheet.getRange("A2:E21").format = {fill: "#FFF9E7", font: {name: "Arial", size: 10, color: "#17332F"}, rowHeight: 25};
  sheet.getRange("A2:B21").setNumberFormat("@");
  sheet.getRange("C2:C21").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("D2:E21").setNumberFormat("#,##0.00");
  const notes = workbook.worksheets.getItem("ReadMe");
  notes.getRange("A38:B42").values = [
    ["CashBalances", "Optional cash-count and bank-balance snapshots. Leave empty until you have real counted balances."],
    ["Required fields", "balance_id, business_id, as_of_date, cash_on_hand_mmk, bank_balance_mmk"],
    ["Balance ID", "Use a stable unique ID such as CB-20261022. Use the business_id from Settings. One row per date."],
    ["Date and amounts", "Use a real Excel date. Enter counted cash and the combined bank balance for that date, in MMK. Confirmed zero is 0."],
    ["Reconciliation only", "These are balance observations, not new income. They do not add cash or replace the opening balance. No sample amounts were invented."],
  ];
  notes.getRange("A38:B42").format = {font: {name: "Arial", size: 10}, rowHeight: 44, verticalAlignment: "center"};
  notes.getRange("A38:A42").format.columnWidth = 25;
  notes.getRange("B38:B42").format.columnWidth = 110;
  notes.getRange("B38:B42").format.wrapText = true;
  workbook.recalculate();
  console.log((await workbook.inspect({kind: "table", range: "CashBalances!A1:E2", include: "values", tableMaxRows: 2, tableMaxCols: 5, maxChars: 600})).ndjson);
  for (const [sheetName, range, suffix] of [["CashBalances", "A1:E4", "columns"], ["ReadMe", "A38:B42", "instructions"]]) {
    const image = await workbook.render({sheetName, range, scale: 1.2, format: "png"});
    await fs.writeFile(path.join(folder, `${filename}-${suffix}.png`), new Uint8Array(await image.arrayBuffer()));
  }
  await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(folder, filename));
  if (filename === "bizflow-template.xlsx") await fs.copyFile(path.join(folder, filename), source);
}
