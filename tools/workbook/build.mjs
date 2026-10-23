// Run with the bundled artifact-tool runtime; see shared/workbook-template/README.md.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(
  await fs.readFile(path.join(root, "shared/contracts/workbook-schema.json"), "utf8"),
).sheets;
const personas = [
  { id: "tea-shop", name: "Mingalar Tea Shop", factor: 1, loan: false },
  { id: "grocery", name: "Shwe Grocery", factor: 3, loan: true },
  { id: "workshop", name: "Aye Chan Workshop", factor: 5, loan: true },
];
const previewRoot = path.join(root, ".artifacts/workbook-previews");
await fs.mkdir(previewRoot, { recursive: true });
await fs.mkdir(path.join(root, "database/seed"), { recursive: true });
await fs.mkdir(path.join(root, "shared/workbook-template"), { recursive: true });

for (const persona of [
  ...personas,
  { id: "YOUR_BUSINESS_ID", name: "Your business", factor: 1, template: true },
]) {
  const f = persona.factor,
    b = persona.id;
  const data = {
    Settings: [
      [
        b,
        persona.name,
        "MMK",
        new Date("2026-10-01T00:00:00Z"),
        persona.template ? 0 : 1000000 * f,
      ],
    ],
    Products: [
      ["P001", b, persona.id === "workshop" ? "Repair parts" : "Daily stock", 100, 3000 * f],
    ],
    Sales: [
      ["S001", b, new Date("2026-10-03T00:00:00Z"), "P001", 10, 5000 * f, "cash", 50000 * f],
      ["S002", b, new Date("2026-10-06T00:00:00Z"), "P001", 20, 5000 * f, "credit", 20000 * f],
      ["S003", b, new Date("2026-10-12T00:00:00Z"), "P001", 15, 5000 * f, "cash", 75000 * f],
    ],
    CustomerReceipts: [["R001", b, new Date("2026-10-10T00:00:00Z"), "S002", 30000 * f]],
    Purchases: [
      ["B001", b, new Date("2026-10-02T00:00:00Z"), "P001", 40, 3000 * f, "credit", 20000 * f],
    ],
    SupplierPayments: [["SP001", b, new Date("2026-10-11T00:00:00Z"), "B001", 40000 * f]],
    Expenses: [
      ["E001", b, new Date("2026-10-05T00:00:00Z"), "rent", 50000, "Monthly shop rent"],
      ["E002", b, new Date("2026-10-15T00:00:00Z"), "utilities", 15000 * f, "Power and water"],
    ],
    Loans: persona.loan
      ? [
          [
            "L001",
            b,
            new Date("2026-10-01T00:00:00Z"),
            "Synthetic lender",
            "reducing_balance",
            200000 * f,
          ],
        ]
      : [],
    LoanPayments: persona.loan
      ? [["LP001", b, new Date("2026-10-18T00:00:00Z"), "L001", 10000 * f, 2000 * f]]
      : [],
    CashBalances: [],
    CashAdjustments: [
      ["A001", b, new Date("2026-10-08T00:00:00Z"), "in", 10000 * f, "Owner contribution"],
    ],
  };
  const workbook = Workbook.create();
  for (const [name, spec] of Object.entries(schema)) {
    if (persona.template && ["Loans", "LoanPayments"].includes(name)) continue;
    const sheet = workbook.worksheets.add(name);
    sheet.showGridLines = false;
    sheet.freezePanes.freezeRows(1);
    const fields = { ...spec.fields, ...spec.payload_fields };
    const headers = Object.keys(fields);
    const rows = (persona.template ? [] : data[name]).map(row => headers.map((_, index) => row[index] ?? null));
    const body = [headers, ...rows];
    const range = sheet.getRangeByIndexes(0, 0, body.length, headers.length);
    range.values = body;
    range.format.font = { name: "Arial", size: 10, color: "#17332F" };
    range.format.rowHeight = 25;
    range.format.verticalAlignment = "center";
    const header = sheet.getRangeByIndexes(0, 0, 1, headers.length);
    header.format = {
      fill: "#244B45",
      font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
      rowHeight: 30,
    };
    for (const [index, [field, kind]] of Object.entries(fields).entries()) {
      const column = sheet.getRangeByIndexes(0, index, Math.max(2, body.length), 1);
      column.format.columnWidth =
        field === "business_name"
          ? 30
          : field === "description" || field === "reason"
            ? 32
            : field === "business_id" || field === "lender" || field === "name"
              ? 25
              : Math.max(18, field.length + 4);
      const inputs = sheet.getRangeByIndexes(1, index, Math.max(1, rows.length), 1);
      inputs.format.fill = "#FFF9E7";
      if (kind === "date") inputs.setNumberFormat("yyyy-mm-dd");
      if (kind.includes("money")) inputs.setNumberFormat("#,##0.00");
      if (kind.includes("quantity")) inputs.setNumberFormat("#,##0.000");
      if (kind === "id") inputs.setNumberFormat("@");
      if (kind.startsWith("enum:"))
        inputs.dataValidation = { rule: { type: "list", values: kind.slice(5).split(",") } };
    }
  }
  const notes = workbook.worksheets.add("ReadMe");
  notes.showGridLines = false;
  notes.getRange("A1:B9").values = [
    ["BizFlow workbook", "Input instructions"],
    [
      "Data source",
      persona.template
        ? "Blank input template. No sample business data or transactions. Enter your own Settings and records. Currency: MMK."
        : "Synthetic examples for the October 2026 demo. Currency: MMK.",
    ],
    ["Business", "Use one authorized business_id in Settings and every transaction row."],
    [
      "Stable IDs",
      "Keep IDs when editing. Give new rows unique IDs. Never use formulas for inputs.",
    ],
    [
      "Upload",
      "Save as .xlsx, then upload in Data Source settings. All required sheet headers must remain.",
    ],
    [
      "Missing records",
      "Missing rows are retained with a review warning. Upload does not delete history.",
    ],
    ["OneDrive", "Save into OneDrive, wait for cloud sync, then click Sync Now if connected."],
    [
      "Local files",
      "Unsynced local Excel edits require re-upload. They are invisible to Microsoft Graph.",
    ],
    [
      "Template",
      "Keep one Settings row. Add transaction rows below the headers. Amber cells are inputs.",
    ],
  ];
  notes.getRange("A1:B9").format.font = { name: "Arial", size: 10 };
  notes.getRange("A1:B1").format.font = { bold: true, color: "#244B45" };
  notes.getRange("A1:A9").format.columnWidth = 22;
  notes.getRange("B1:B9").format.columnWidth = 110;
  notes.getRange("A1:B9").format.rowHeight = 26;
  workbook.recalculate();
  const check = await workbook.inspect({
    kind: "table",
    range: "Settings!A1:E2",
    include: "values",
    tableMaxRows: 2,
    tableMaxCols: 5,
    maxChars: 1500,
  });
  console.log(persona.id, check.ndjson);
  for (const name of [...Object.keys(schema), "ReadMe"]) {
    if (persona.template && ["Loans", "LoanPayments"].includes(name)) continue;
    const preview = await workbook.render({
      sheetName: name,
      range:
        name === "ReadMe"
          ? "A1:B9"
          : `A1:${String.fromCharCode(64 + Object.keys(schema[name].fields).length)}${Math.max(3, (data[name]?.length || 0) + 1)}`,
      scale: 1,
      format: "png",
    });
    await fs.writeFile(
      path.join(previewRoot, `${persona.id}-${name}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(
    path.join(
      root,
      persona.template
        ? "shared/workbook-template/bizflow-template.xlsx"
        : `database/seed/${persona.id}.xlsx`,
    ),
  );
}
