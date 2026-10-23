import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const input = "C:/Users/Thiri/Downloads/Telegram Desktop/BIZFLOW_Wholesale_Sample_October_2026(2).xlsx";
const out = path.join(root, "outputs/business-id-20261022");
await fs.mkdir(out, {recursive: true});
const hash = value => createHash("sha256").update(value).digest("hex");
const original = hash(await fs.readFile(input));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const names = ["Settings", "Products", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses", "Loans", "LoanPayments", "CashAdjustments"];
let updated = 0;
for (const name of names) {
  const sheet = workbook.worksheets.getItem(name);
  const rows = sheet.getUsedRange().values;
  const index = rows[0].indexOf("business_id");
  if (index < 0) continue;
  for (let row = 1; row < rows.length; row++) {
    if (rows[row].some(value => value !== null && value !== "")) {
      sheet.getRangeByIndexes(row, index, 1, 1).values = [["0c009beb-8c8b-4445-a898-da7ab6661980"]];
      updated++;
    }
  }
}
workbook.recalculate();
console.log((await workbook.inspect({kind: "table", range: "Settings!A1:E2", include: "values", tableMaxRows: 2, tableMaxCols: 5, maxChars: 600})).ndjson);
const preview = await workbook.render({sheetName: "Settings", range: "A1:E2", scale: 1.2, format: "png"});
await fs.writeFile(path.join(out, "settings.png"), new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(out, "Wholesale-Sample-updated-business-id.xlsx"));
if (hash(await fs.readFile(input)) !== original) throw new Error("Source changed");
console.log(`${updated} business_id cells changed; original unchanged.`);
