// Integrated browser smoke test. Use a disposable synthetic demo database.
// BIZFLOW_DEMO_PASSWORD and BIZFLOW_URL are provided by the runner, never committed.
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BIZFLOW_URL || "http://localhost:3000";
if (!process.env.BIZFLOW_DEMO_PASSWORD) throw new Error("Set BIZFLOW_DEMO_PASSWORD");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await fs.mkdir(".artifacts/browser", { recursive: true });
try {
  await page.goto(base);
  await page.getByLabel("Demo password", { exact: true }).fill(process.env.BIZFLOW_DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Active business").selectOption("tea-shop");
  await page.getByRole("heading", { name: /October 2026 cashflow/ }).waitFor();
  await page.screenshot({ path: ".artifacts/browser/financial.png", fullPage: true });
  for (const [path, heading] of [
    ["/working-capital", "No-credit survival toolkit"],
    ["/credit", "Credit application checklist"],
    ["/ai", "AI Analyzer"],
    ["/data-source", "Your data starts here."],
  ]) {
    await page.goto(base + path);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  const chooser = page.getByLabel("Excel workbook");
  await chooser.setInputFiles("database/seed/tea-shop.xlsx");
  await page.getByRole("button", { name: "Import workbook", exact: true }).click();
  await page.getByText(/^(Imported:|Already up to date\. No duplicate)/).waitFor();
  const repeatedUpload = page.waitForResponse(
    (response) => response.url().includes("/data/upload") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Import workbook", exact: true }).click();
  if ((await (await repeatedUpload).json()).status !== "up_to_date")
    throw new Error("Repeated import was not idempotent");
  await page.getByText("Already up to date. No duplicate rows added.").waitFor();
  await page.screenshot({ path: ".artifacts/browser/data-source.png", fullPage: true });
  if (process.env.BIZFLOW_EDITED_WORKBOOK) {
    await page.getByRole("link", { name: "AI Analyzer", exact: true }).click();
    await page.getByRole("button", { name: "Generate local preview", exact: true }).click();
    await page.getByText(/^Preview generated from version/).waitFor();
    await page.getByRole("link", { name: "Data Source", exact: true }).click();
    await chooser.setInputFiles(process.env.BIZFLOW_EDITED_WORKBOOK);
    await page.getByRole("button", { name: "Import workbook", exact: true }).click();
    await page.getByText("Imported: 0 added, 1 updated, 10 unchanged.").waitFor();
    await page.getByRole("link", { name: "AI Analyzer", exact: true }).click();
    await page.getByText(/^Stale: preview uses version/).waitFor();
    await page.getByRole("link", { name: "Financial Health", exact: true }).click();
    await page.getByText("155 K", { exact: true }).waitFor();
    await page.getByLabel("Active business").selectOption("grocery");
    await page.getByText("311 K", { exact: true }).waitFor();
    await page.getByLabel("Active business").selectOption("tea-shop");
    await page.getByRole("link", { name: "Data Source", exact: true }).click();
    const resetResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/demo/reset") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Restore sample data", exact: true }).click();
    if (!(await resetResponse).ok()) throw new Error("Demo reset failed");
    await page.getByRole("link", { name: "Financial Health", exact: true }).click();
    await page.getByText("125 K", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Data Source", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".artifacts/browser/mobile.png", fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Browser smoke passed: sign-in, five routes, refresh, import and business selection.",
  );
} catch (error) {
  await page.screenshot({ path: ".artifacts/browser/failure.png", fullPage: true });
  console.error((await page.locator("body").innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
}
