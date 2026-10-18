import { chromium, expect, test, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The published release, end to end, in a brand-new browser profile: no local model
// server. Build first with the public variables (docs/step18-2/HUGGINGFACE_RELEASE.md §5).
// Run: playwright test -c playwright.browser-ai.config.ts --project=public
const APP = process.env.PIQ_APP_URL ?? "http://127.0.0.1:4198";
const HF = /^https:\/\/(huggingface\.co|[^/]+\.hf\.co)\//;
const RESULTS = process.env.PIQ_APP_URL
  ? "docs/step18-2/preview-results.json"
  : "docs/step18-2/public-release-results.json";
const results: Record<string, unknown> = existsSync(RESULTS)
  ? JSON.parse(readFileSync(RESULTS, "utf8"))
  : {};
const plan = JSON.parse(
  readFileSync("docs/step18-1/classification-plan.json", "utf8"),
).cases as { id: string; text: string; expected: string }[];
const profile = mkdtempSync(join(tmpdir(), "piq-hf-")); // clean profile, short path

async function launch(online: boolean) {
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--enable-unsafe-webgpu"],
    viewport: { width: 1440, height: 900 },
  });
  const requests: string[] = [];
  const errors: string[] = [];
  context.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  context.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await context.route(
    (url) => !url.href.startsWith(APP + "/") && !(online && HF.test(url.href)),
    (route) => route.abort(),
  );
  const page = await context.newPage();
  return { context, page, requests, errors };
}

async function suggest(page: Page, text: string) {
  const paste = page.locator(".dr-paste");
  if ((await paste.getAttribute("open")) === null)
    await paste.locator("summary").click();
  await paste.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Use this text" }).click();
  await page.getByRole("button", { name: "Suggest a type" }).click();
  const box = page.locator(".dr-suggestion").nth(1);
  await expect(
    box.locator('[data-tone="suggestion"], [role="alert"]'),
  ).toBeVisible({ timeout: 5 * 60_000 });
  return {
    label: await box
      .locator('[data-tone="suggestion"]')
      .textContent()
      .catch(() => null),
    note: await box.locator(".dr-note").textContent(),
  };
}

test.describe.configure({ mode: "serial", timeout: 90 * 60_000 });

test("first visit: consent, download from Hugging Face, classify, calculate", async () => {
  const { context, page, requests, errors } = await launch(true);
  await page.goto(APP + "/");
  await page.getByRole("link", { name: /Document assistant/ }).click();
  await page.locator("#research-lab").scrollIntoViewIfNeeded();
  await page
    .getByRole("radio", { name: /PropertyIQ research Qwen3-1.7B/ })
    .check();
  await expect(page.locator("#research-lab")).toContainText("huggingface.co");
  expect(requests.filter((u) => HF.test(u))).toEqual([]); // nothing before consent
  await page.locator("#research-lab .dr-approve input").check();
  const t0 = Date.now();
  await page.locator("#research-lab .button.primary").click();
  const status = page.getByTestId("lab-status");
  await expect(status).toHaveText(/^(Ready|Could not load)/, {
    timeout: 80 * 60_000,
  });
  const ready = await status.textContent();
  const downloadMs = Date.now() - t0;
  expect(ready).toMatch(/^Ready/);
  const cases = [];
  for (const c of plan)
    cases.push({
      id: c.id,
      expected: c.expected,
      ...(await suggest(page, c.text)),
    });
  // Full workflow on the same page: upload → type → review → approve → calculate.
  await page
    .locator(".dr-file")
    .setInputFiles("docs/step18-1/noi-reviewed-fixture.csv");
  await page.getByRole("button", { name: "Suggest a type" }).click();
  await expect(
    page.locator(".dr-suggestion").nth(1).locator('[data-tone="suggestion"]'),
  ).toBeVisible();
  await page.getByRole("radio", { name: /^T-12/ }).check();
  await page.getByRole("button", { name: "Confirm type" }).click();
  await page.getByRole("button", { name: "Extract figures" }).click();
  await page.getByLabel("Reviewed value, Other income, row 6").fill("2500");
  await page.getByRole("button", { name: "Check figures" }).click();
  await page.getByRole("checkbox", { name: /I checked these figures/ }).check();
  await page.getByRole("button", { name: "Calculate NOI" }).click();
  await expect(page.getByTestId("noi")).toHaveText("$62,500.00");
  results.firstVisit = {
    ready,
    downloadAndLoadMs: downloadMs,
    hfRequests: requests.filter((u) => HF.test(u)).length,
    otherHosts: requests.filter((u) => !u.startsWith(APP + "/") && !HF.test(u)),
    cases,
    errors,
  };
  await context.close();
});

test("return visit with the internet blocked loads from browser storage", async () => {
  const { context, page, requests, errors } = await launch(false);
  await page.goto(APP + "/#research-lab");
  await page
    .getByRole("radio", { name: /PropertyIQ research Qwen3-1.7B/ })
    .check();
  await expect(page.locator("#research-lab")).toContainText(
    "stored in this browser",
  );
  const t0 = Date.now();
  await page.locator("#research-lab .button.primary").click();
  const status = page.getByTestId("lab-status");
  await expect(status).toHaveText(/^(Ready|Could not load)/, {
    timeout: 10 * 60_000,
  });
  const ready = await status.textContent();
  const s = await suggest(page, plan[2].text);
  results.returnVisit = {
    ready,
    loadMs: Date.now() - t0,
    ...s,
    nonAppRequests: requests.filter((u) => !u.startsWith(APP + "/")),
    errors,
  };
  await context.close();
  expect(ready).toMatch(/^Ready.*from browser storage/);
  expect(requests.filter((u) => !u.startsWith(APP + "/"))).toEqual([]);
});

test.afterAll(() =>
  writeFileSync(
    RESULTS,
    JSON.stringify({ profile, ...results }, null, 2) + "\n",
  ),
);
