// Run with the bundled spreadsheet runtime. Only Loans and ReadMe are edited.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "outputs/credit-hub-20261022");
await fs.mkdir(out, { recursive: true });
const schema = JSON.parse(await fs.readFile(path.join(root, "shared/contracts/workbook-schema.json"), "utf8")).sheets.Loans;
const catalog = JSON.parse(await fs.readFile(path.join(root, "shared/contracts/loan-products.json"), "utf8")).banks;
const newFields = Object.entries(schema.payload_fields);

for (const sample of [false, true]) {
  const source = path.join(root, sample ? "database/seed/grocery.xlsx" : "shared/workbook-template/bizflow-template.xlsx");
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
  console.log((await wb.inspect({kind: "table", range: "Loans!A1:F3", include: "values", tableMaxRows: 3, tableMaxCols: 6, maxChars: 1200})).ndjson);
  if (!sample) {
    const before = await wb.render({sheetName: "Loans", range: "A1:F3", scale: 1, format: "png"});
    await fs.writeFile(path.join(out, "loans-before.png"), new Uint8Array(await before.arrayBuffer()));
  }
  const loans = wb.worksheets.getItem("Loans");
  const headers = [...Object.keys(schema.fields), ...newFields.map(([key]) => key)];
  loans.getRangeByIndexes(0, 6, 1, newFields.length).values = [newFields.map(([key]) => key)];
  loans.getRangeByIndexes(0, 6, 1, newFields.length).format = {
    fill: "#244B45", font: {name: "Arial", size: 10, bold: true, color: "#FFFFFF"}, rowHeight: 32,
  };
  for (const [index, [field, kind]] of newFields.entries()) {
    const column = loans.getRangeByIndexes(0, index + 6, 101, 1);
    column.format.columnWidth = Math.max(20, field.length + 4);
    const input = loans.getRangeByIndexes(1, index + 6, 100, 1);
    input.format.fill = "#FFF9E7";
    input.format.font = {name: "Arial", size: 10, color: "#17332F"};
    input.format.rowHeight = 25;
    if (kind === "date") input.setNumberFormat("yyyy-mm-dd");
    if (field === "annual_rate_pct") input.setNumberFormat('0.00"% annually"');
    if (kind.startsWith("enum:")) input.dataValidation = {rule: {type: "list", values: kind.slice(5).split(",")}};
    if (field === "loan_product_id") input.dataValidation = {rule: {type: "list", values: catalog.flatMap(bank => bank.products.map(product => product.id))}};
    if (field === "term_months") input.dataValidation = {rule: {type: "whole", operator: "between", formula1: 1, formula2: 1200}};
  }
  const notes = wb.worksheets.getItem("ReadMe");
  const instructions = [
    ["Credit Hub import", "For KBZ or Yoma, use the matching bank and loan product. Fill all seven new Loans fields together."],
    ["Annual interest", "Enter the signed agreement rate: 12 means 12% annually. Zero means interest-free. Blank means unknown."],
    ["Repayment dates", "Use a real Excel date. Monthly due dates follow the first payment day, clipped at month end."],
    ["Supported estimate", "Reducing balance, monthly, first payment one month after disbursement. Other schedules require lender details."],
    ["Other banks", "Multiple banks are allowed. Banks outside the KBZ and Yoma catalog use manually entered terms; treat results as estimates and check the signed agreement or bank statement."],
    ["Product mapping", "Copy bank_id, loan_product_id and the exact product name below. The importer checks that they match."],
    ["Agreement source", sample ? "SYNTHETIC DEMO ONLY. Sample bank/product and 12% rate illustrate import fields, not a lender offer." : "Use your own signed loan agreement. The bank guide does not set the rate of an existing loan."],
    ...catalog.flatMap(bank => bank.products.map(product => [product.id, `${bank.id} | ${bank.name} | ${product.name}`])),
  ];
  notes.getRangeByIndexes(11, 0, instructions.length, 2).values = instructions;
  notes.getRangeByIndexes(11, 0, instructions.length, 2).format = {font: {name: "Arial", size: 10, color: "#17332F"}, rowHeight: 34, verticalAlignment: "center"};
  notes.getRange("A12:A24").format.columnWidth = 25;
  notes.getRange("B12:B24").format.columnWidth = 110;
  notes.getRange("B12:B24").format.wrapText = true;
  if (sample) {
    const row = loans.getRange("A2:F2").values[0];
    loans.getRange("D2").values = [["KBZ Bank"]];
    const terms = {bank_id: "kbz", loan_product_id: "kbz-term", loan_product: "SME Term Loan", annual_rate_pct: 12,
      term_months: 24, first_payment_date: new Date("2026-11-01T00:00:00Z"), payment_frequency: "monthly"};
    loans.getRangeByIndexes(1, 6, 1, newFields.length).values = [newFields.map(([key]) => terms[key])];
    console.log("Synthetic sample principal", row[5]);
  }
  wb.recalculate();
  console.log((await wb.inspect({kind: "table", range: "Loans!G1:M2", include: "values", tableMaxRows: 2, tableMaxCols: 7, maxChars: 2000})).ndjson);
  console.log((await wb.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!", options: {useRegex: true, maxResults: 5}, maxChars: 500})).ndjson);
  for (const [sheetName, range, suffix] of [["Loans", "G1:M3", "terms"], ["ReadMe", "A12:B24", "instructions"]]) {
    const rendered = await wb.render({sheetName, range, scale: 1.3, format: "png"});
    await fs.writeFile(path.join(out, `${sample ? "sample" : "template"}-${suffix}.png`), new Uint8Array(await rendered.arrayBuffer()));
  }
  const output = await SpreadsheetFile.exportXlsx(wb);
  const destination = path.join(out, sample ? "credit-import-synthetic-sample.xlsx" : "credit-import-template.xlsx");
  await output.save(destination);
  if (!sample) await fs.copyFile(destination, source);
}
