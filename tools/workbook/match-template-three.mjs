import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "outputs/template-three-20261022");
await fs.mkdir(out, {recursive: true});
const source = await SpreadsheetFile.importXlsx(await FileBlob.load("C:/Users/Thiri/Downloads/Telegram Desktop/BIZFLOW_Wholesale_Sample_October_2026(2).xlsx"));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load("C:/Users/Thiri/Downloads/0c009beb-8c8b-4445-a898-da7ab6661980-template(3).xlsx"));
const profile = workbook.worksheets.getItem("Settings").getRange("A2:B2").values[0];
const names = ["Settings", "Products", "Sales", "CustomerReceipts", "Purchases", "SupplierPayments", "Expenses", "CashAdjustments"];
const counts = {};
for (const name of names) {
  const original = source.worksheets.getItem(name).getUsedRange().values;
  const sheet = workbook.worksheets.getItem(name);
  const headers = sheet.getUsedRange().values[0];
  const rows = original.slice(1).filter(row => row.some(value => value !== null && value !== ""));
  const mapped = rows.map(row => headers.map(header => {
    if (header === "business_id") return profile[0];
    if (name === "Settings" && header === "business_name") return profile[1];
    const index = original[0].indexOf(header);
    return index >= 0 ? row[index] : null;
  }));
  const format = sheet.getRangeByIndexes(1, 0, 1, headers.length);
  for (let index = 2; index <= mapped.length; index++) sheet.getRangeByIndexes(index, 0, 1, headers.length).copyFrom(format, "all");
  if (mapped.length) sheet.getRangeByIndexes(1, 0, mapped.length, headers.length).values = mapped;
  const businessColumn = headers.indexOf("business_id");
  if (businessColumn >= 0) sheet.getRangeByIndexes(0, businessColumn, mapped.length + 1, 1).format.columnWidth = 46;
  counts[name] = mapped.length;
}
const notes = workbook.worksheets.getItem("ReadMe");
notes.getRange("A12:B14").values = [
  ["Source", "Data copied from BIZFLOW_Wholesale_Sample_October_2026(2).xlsx into the template(3) layout. Original files unchanged."],
  ["Business", "Uses the destination business ID and name: Mi Thar Su. All original transaction IDs, amounts and dates retained. Loan sheets/data excluded as requested."],
  ["Unavailable inputs", "Historical unit costs/COGS, supplier due dates and expense settlement details are not in the source and remain blank. They are unknown, not zero."],
];
notes.getRange("A12:B14").format = {font: {name: "Arial", size: 10}, rowHeight: 48};
notes.getRange("A12:A14").format.columnWidth = 25;
notes.getRange("B12:B14").format.columnWidth = 110;
notes.getRange("B12:B14").format.wrapText = true;
workbook.recalculate();
for (const name of names) {
  const count = workbook.worksheets.getItem(name).getUsedRange().values[0].length;
  const image = await workbook.render({sheetName: name, range: `A1:${String.fromCharCode(64 + count)}4`, scale: 1, format: "png"});
  await fs.writeFile(path.join(out, `${name}.png`), new Uint8Array(await image.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(out, "Mi-Thar-Su-wholesale-import.xlsx"));
console.log(counts);
