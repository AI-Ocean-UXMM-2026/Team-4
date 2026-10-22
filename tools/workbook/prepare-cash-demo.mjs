import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = "C:/Users/Thiri/Downloads/0c009beb-8c8b-4445-a898-da7ab6661980-template(1).xlsx";
const folder = path.join(root, "outputs/cash-planning-demo-20261022");
await fs.mkdir(folder, {recursive: true});
const originalHash = createHash("sha256").update(await fs.readFile(source)).digest("hex");
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const sheet = workbook.worksheets.getItem("Expenses");
const before = await workbook.render({sheetName: "Expenses", range: "A1:F5", scale: 1, format: "png"});
await fs.writeFile(path.join(folder, "expenses-before.png"), new Uint8Array(await before.arrayBuffer()));
if (process.argv.includes("--preview")) process.exit(0);
const rows = sheet.getRange("A2:F19").values;
const cutoff = Date.UTC(2026, 9, 22);
const asDate = value => typeof value === "number" ? new Date(Date.UTC(1899, 11, 30) + value * 86400000) : new Date(value);
let paid = 0, unpaid = 0;
const payments = rows.map(row => {
  if (asDate(row[2]).getTime() <= cutoff) { paid++; return ["paid", row[2], row[4]]; }
  unpaid++; return ["unpaid", null, 0];
});
sheet.getRange("G1:I1").values = [["payment_status", "paid_date", "amount_paid_mmk"]];
sheet.getRange("G2:I19").values = payments;
sheet.getRange("G1:I1").format = {fill: "#244B45", font: {name: "Arial", size: 10, bold: true, color: "#FFFFFF"}, rowHeight: 30};
sheet.getRange("G1:I19").format.columnWidth = 24;
sheet.getRange("G2:I19").format = {fill: "#FFF9E7", font: {name: "Arial", size: 10, color: "#17332F"}, rowHeight: 25};
sheet.getRange("G2:G101").dataValidation = {rule: {type: "list", values: ["paid", "partial", "unpaid"]}};
sheet.getRange("H2:H101").setNumberFormat("yyyy-mm-dd");
sheet.getRange("I2:I101").setNumberFormat("#,##0.00");
const notes = workbook.worksheets.getItem("ReadMe");
notes.getRange("A32:B35").values = [
  ["DEMO PAYMENT ASSUMPTIONS", "User-authorized example only. As of 2026-10-22: expenses dated on/before this date are fully paid on their recorded dates. Later expenses are unpaid."],
  ["Original facts retained", "All existing IDs, dates, amounts, receipts, supplier/loan payments and cash adjustments are unchanged. No new transactions invented."],
  ["Opening balance", "Retained from source: 2026-10-01, 8,500,000 MMK. This is not independently verified against bank statements."],
  ["Loan terms", "Previously authorized demo terms retained: KBZ SME Term Loan, annual 12%, 24 months, monthly reducing balance, first due 2026-11-03. Not verified lender terms."],
];
notes.getRange("A32:B35").format = {font: {name: "Arial", size: 10}, rowHeight: 48, verticalAlignment: "center"};
notes.getRange("A32:A35").format.columnWidth = 28;
notes.getRange("B32:B35").format.columnWidth = 110;
notes.getRange("B32:B35").format.wrapText = true;
notes.getRange("A32:B32").format.fill = "#FFF0CC";
workbook.recalculate();
console.log((await workbook.inspect({kind: "table", range: "Expenses!G1:I5", include: "values", tableMaxRows: 5, tableMaxCols: 3, maxChars: 1000})).ndjson);
console.log((await workbook.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?", options: {useRegex: true, maxResults: 5}, maxChars: 300})).ndjson);
for (const [name, range, file] of [["Expenses", "G1:I9", "expense-payments"], ["ReadMe", "A32:B35", "demo-assumptions"]]) {
  const image = await workbook.render({sheetName: name, range, scale: 1.2, format: "png"});
  await fs.writeFile(path.join(folder, `${file}.png`), new Uint8Array(await image.arrayBuffer()));
}
const output = path.join(folder, "Mi-Thar-Su-cash-planning-demo.xlsx");
await (await SpreadsheetFile.exportXlsx(workbook)).save(output);
if (createHash("sha256").update(await fs.readFile(source)).digest("hex") !== originalHash) throw new Error("Original changed");
console.log(JSON.stringify({output, paid, unpaid, sourceUnchanged: true}));
