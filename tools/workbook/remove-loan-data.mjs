import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const folder = path.join(root, "outputs/business-id-20261022");
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(folder, "Wholesale-Sample-updated-business-id.xlsx")));
for (const name of ["Loans", "LoanPayments"]) {
  const sheet = workbook.worksheets.getItem(name);
  sheet.delete();
}
workbook.recalculate();
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(folder, "Wholesale-Sample-no-loan-sheets.xlsx"));
