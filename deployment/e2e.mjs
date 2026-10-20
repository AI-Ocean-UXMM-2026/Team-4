// Public UI acceptance; no fake authentication and no account is created by this smoke.
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BIZFLOW_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await fs.mkdir(".artifacts/auth", { recursive: true });
try {
  await page.goto(base + "/");
  await page.getByRole("heading", { name: "Sign in to BIZFLOW", exact: true }).waitFor();
  for (const path of ["/working-capital", "/credit", "/ai", "/data-source", "/onboarding"]) {
    await page.goto(base + path);
    await page.getByRole("heading", { name: "Sign in to BIZFLOW", exact: true }).waitFor();
  }
  if (await page.getByLabel("Demo password", { exact: true }).count())
    throw new Error("Demo sign-in still exists");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  if ((await page.getByLabel("Password", { exact: true }).getAttribute("type")) !== "text")
    throw new Error("Password toggle failed");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  const config = await (await page.request.get(base + "/api/v1/config")).json();
  if (config.auth_status.ready) {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Enter a valid email address." }).waitFor();
  } else {
    await page.getByRole("alert").waitFor();
    if (!(await page.getByRole("button", { name: "Sign in", exact: true }).isDisabled()))
      throw new Error("Unconfigured sign-in is enabled");
  }
  await page.screenshot({ path: ".artifacts/auth/sign-in.png", fullPage: true });
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Test Owner");
  await page.getByLabel("Email address", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("An-example-password1!");
  if (config.auth_status.ready) {
    await page.getByLabel("Confirm password", { exact: true }).fill("different");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByText("Passwords do not match.", { exact: true }).waitFor();
  }
  await page.getByLabel("Confirm password", { exact: true }).fill("An-example-password1!");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Company or business name", { exact: true }).waitFor();
  if (!config.auth_status.ready) {
    let submissions = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/auth/register")) submissions++;
    });
    await page.getByLabel("Company or business name", { exact: true }).fill("Diagnostic Business");
    await page.getByLabel("Business type or industry", { exact: true }).fill("Retail");
    await page.getByLabel("City or township", { exact: true }).fill("Yangon");
    if ((await page.getByRole("alert").count()) !== 1)
      throw new Error("Expected only one configuration message");
    if (!(await page.getByRole("button", { name: "Create account", exact: true }).isDisabled()))
      throw new Error("Unconfigured signup is enabled");
    if (submissions !== 0) throw new Error("Unconfigured page sent a signup request");
  }
  await page.screenshot({ path: ".artifacts/auth/registration.png", fullPage: true });
  await page.goto(base + "/auth/callback?error=otp_expired");
  await page.getByRole("heading", { name: "We couldn’t verify this link", exact: true }).waitFor();
  await page.goto(base + "/reset-password");
  await page.getByRole("heading", { name: "Open your password reset link", exact: true }).waitFor();
  await page.goto(base + "/forgot-password");
  await page.getByRole("heading", { name: "Forgot your password?", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/sign-in");
  await page.getByRole("heading", { name: "Sign in to BIZFLOW", exact: true }).waitFor();
  await page.screenshot({ path: ".artifacts/auth/mobile.png", fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Public auth UI passed: protected redirect, fields/toggle, validation, registration steps, invalid link and reset guards. No real email delivery was tested.",
  );
} catch (error) {
  await page.screenshot({ path: ".artifacts/auth/failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
