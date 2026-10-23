import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = "C:/Users/Thiri/Downloads/Telegram Desktop/BIZFLOW_Wholesale_Sample_October_2026(2).xlsx";
const templatePath = "C:/Users/Thiri/Downloads/0c009beb-8c8b-4445-a898-da7ab6661980-template(1).xlsx";
const out = path.join(root, "outputs/mi-thar-su-credit-20261022");
await fs.mkdir(out, { recursive: true });
const hash = async p => createHash("sha256").update(await fs.readFile(p)).digest("hex");
const hashes = [await hash(sourcePath), await hash(templatePath)];
const source = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const target = await SpreadsheetFile.importXlsx(await FileBlob.load(templatePath));
const settings = target.worksheets.getItem("Settings").getRange("A2:E2").values[0];
const catalog = JSON.parse(await fs.readFile(path.join(root, "shared/contracts/workbook-schema.json"), "utf8")).sheets;
const loanRows = source.worksheets.getItem("Loans").getUsedRange().values;
const loanHeader = loanRows[0];
const kept = loanRows.slice(1).filter(row => String(row[loanHeader.indexOf("lender")]).trim().toLowerCase() === "kbz bank");
const loanIds = new Set(kept.map(row => row[loanHeader.indexOf("loan_id")]));
if (process.argv.includes("--preview")) {
  const before = await target.render({sheetName: "Loans", range: "A1:M3", scale: 1, format: "png"});
  await fs.writeFile(path.join(out, "template-before.png"), new Uint8Array(await before.arrayBuffer()));
  console.log("Preview only. No workbooks changed.");
  process.exit(0);
}
const counts = {};
for (const name of Object.keys(catalog)) {
  const input = source.worksheets.getItem(name).getUsedRange().values;
  const headers = input[0];
  const sheet = target.worksheets.getItem(name);
  const destHeaders = sheet.getRangeByIndexes(0, 0, 1, name === "Loans" ? 13 : headers.length).values[0];
  const businessColumn = destHeaders.indexOf("business_id");
  if (businessColumn >= 0) sheet.getRangeByIndexes(0, businessColumn, 101, 1).format.columnWidth = 46;
  let rows = input.slice(1).filter(row => row.some(value => value !== null && value !== ""));
  if (name === "Loans") rows = kept;
  if (name === "LoanPayments") rows = rows.filter(row => loanIds.has(row[headers.indexOf("loan_id")]));
  const mapped = rows.map(row => destHeaders.map(key => {
    if (key === "business_id") return settings[0];
    if (name === "Settings" && key === "business_name") return settings[1];
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : null;
  }));
  if (mapped.length) {
    const firstRow = sheet.getRangeByIndexes(1, 0, 1, destHeaders.length);
    for (let row = 2; row <= mapped.length; row++) sheet.getRangeByIndexes(row, 0, 1, destHeaders.length).copyFrom(firstRow, "all");
    sheet.getRangeByIndexes(1, 0, mapped.length, destHeaders.length).values = mapped;
  }
  counts[name] = mapped.length;
}
const loans = target.worksheets.getItem("Loans");
loans.getRange("G2:M2").values = [["kbz", "kbz-term", "SME Term Loan", 12, 24, new Date("2026-11-03T00:00:00Z"), "monthly"]];
const notes = target.worksheets.getItem("ReadMe");
const provenance = [
  ["Data copied from", "BIZFLOW_Wholesale_Sample_October_2026(2).xlsx. The original source file is unchanged."],
  ["Destination business", `${settings[1]} (${settings[0]}). All business_id values use the destination template ID.`],
  ["Loan selection", "KBZ LOAN-001 and LP-001/LP-002 only. Yoma LOAN-002 and LP-003 excluded from this copy at the user's request."],
  ["DEMO LOAN TERMS", "FICTIONAL: SME Term Loan, 12% annual, 24 months, monthly reducing balance. First payment 2026-11-03. Not a verified KBZ offer or agreement."],
  ["Recorded facts", "Original KBZ principal and payment amounts are preserved. Demo terms do not validate actual payment timing or interest amounts."],
];
notes.getRange("A26:B30").values = provenance;
notes.getRange("A26:B30").format = {font: {name: "Arial", size: 10, color: "#17332F"}, rowHeight: 42, verticalAlignment: "center"};
notes.getRange("A26:A30").format.columnWidth = 25;
notes.getRange("B26:B30").format.columnWidth = 110;
notes.getRange("B26:B30").format.wrapText = true;
notes.getRange("A29:B29").format.fill = "#FFF0CC";
target.recalculate();
console.log((await target.inspect({kind: "table", range: "Loans!A1:M2", include: "values", tableMaxRows: 2, tableMaxCols: 13, maxChars: 2000})).ndjson);
console.log((await target.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!", options: {useRegex: true, maxResults: 5}, maxChars: 500})).ndjson);
for (const [sheetName, range, filename] of [["Loans", "A1:F3", "loan-principal"], ["Loans", "G1:M3", "loan-terms"], ["Settings", "A1:E2", "business"], ["ReadMe", "A26:B30", "demo-notes"]]) {
  const image = await target.render({sheetName, range, scale: 1.1, format: "png"});
  await fs.writeFile(path.join(out, `${filename}.png`), new Uint8Array(await image.arrayBuffer()));
}
for (const name of Object.keys(catalog)) {
  if (["Loans", "Settings"].includes(name)) continue;
  const columns = Object.keys(catalog[name].fields).length;
  const image = await target.render({sheetName: name, range: `A1:${String.fromCharCode(64 + columns)}4`, scale: 1, format: "png"});
  await fs.writeFile(path.join(out, `${name}.png`), new Uint8Array(await image.arrayBuffer()));
}
const outputPath = path.join(out, "Mi-Thar-Su-KBZ-demo-import.xlsx");
await (await SpreadsheetFile.exportXlsx(target)).save(outputPath);
if (await hash(sourcePath) !== hashes[0] || await hash(templatePath) !== hashes[1]) throw new Error("An original file changed");
await fs.writeFile(path.join(out, "source-check.json"), JSON.stringify({sourcePath, templatePath, sourceSHA256: hashes[0], templateSHA256: hashes[1], counts}, null, 2));
console.log(JSON.stringify({outputPath, counts, originalsUnchanged: true}));
