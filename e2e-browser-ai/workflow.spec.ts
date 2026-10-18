import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Document review workflow in the VITE_BROWSER_AI build. No model is downloaded here:
// the keyword rules and the deterministic calculation need none.
const APP = "http://127.0.0.1:4198";
const FIXTURE = "docs/step18-1/noi-reviewed-fixture.csv";
const shots = (page: Page, name: string) =>
  page.screenshot({
    path: `docs/step18-2/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });

async function open(page: Page) {
  const requests: string[] = [];
  page.context().on("request", (r) => requests.push(r.url()));
  await page.goto(APP + "/#documents");
  await expect(
    page.getByRole("heading", { name: /Review an operating statement/ }),
  ).toBeVisible();
  return requests;
}

async function upload(page: Page, file = FIXTURE) {
  await page.locator(".dr-file").setInputFiles(file);
  await expect(page.getByLabel("Current document")).toContainText(
    "noi-reviewed-fixture.csv",
  );
}

async function confirmType(page: Page, label: string) {
  await page.getByRole("radio", { name: new RegExp(`^${label}`) }).check();
  await page.getByRole("button", { name: "Confirm type" }).click();
  await expect(page.getByText(`Confirmed by you: ${label}`)).toBeVisible();
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

test("upload → type → review → approve → NOI, with invalidation", async ({
  page,
}) => {
  const requests = await open(page);
  await upload(page);
  // Keyword rules see no type phrase in this table; the model is optional.
  await expect(page.locator(".dr-suggestion").first()).toContainText("Unknown");
  await expect(
    page.getByRole("button", { name: "Extract figures" }),
  ).toHaveCount(0);
  await confirmType(page, "T-12");
  await page.getByRole("button", { name: "Extract figures" }).click();
  const value = page.getByLabel("Reviewed value, Other income, row 6");
  await expect(value).toHaveValue("2400");
  await value.fill("2500");
  await expect(page.locator("tr[data-changed]")).toContainText("Corrected");
  await page.getByRole("button", { name: "Check figures" }).click();
  const calculate = page.getByRole("button", { name: "Calculate NOI" });
  await expect(calculate).toBeDisabled();
  await page.getByRole("checkbox", { name: /I checked these figures/ }).check();
  await calculate.click();
  await expect(page.getByTestId("noi")).toHaveText("$62,500.00");
  await expect(page.getByText("Other income, row 6: 2400 →")).toBeVisible();
  await page.getByText("Audit trail").click();
  await expect(page.locator(".dr-audit pre")).toContainText(
    '"approved_by_user": true',
  );
  await expect(page.locator(".dr-audit pre")).toContainText(
    createHash("sha256").update(readFileSync(FIXTURE)).digest("hex"),
  );
  expect(
    (await new AxeBuilder({ page }).include(".dr-overlay").analyze())
      .violations,
  ).toEqual([]);
  await noOverflow(page);
  await shots(page, "workflow-result");

  // Any edit clears the approval and the result.
  await value.fill("2600");
  await expect(page.getByTestId("noi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Calculate NOI" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Check figures" }).click();
  await expect(
    page.getByRole("checkbox", { name: /I checked these figures/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Calculate NOI" }),
  ).toBeDisabled();

  // Only the app itself was contacted: no model host, bridge, Ollama or Open WebUI.
  expect(requests.filter((u) => !u.startsWith(APP + "/"))).toEqual([]);
});

test("blank amounts stay blank and block the calculation", async ({ page }) => {
  await open(page);
  const csv = readFileSync(FIXTURE, "utf8").replace(
    "vacancy rate,5,percent",
    "vacancy rate,,percent",
  );
  await page.locator(".dr-file").setInputFiles({
    name: "missing-vacancy.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await confirmType(page, "T-12");
  await page.getByRole("button", { name: "Extract figures" }).click();
  await expect(page.locator("tbody tr").nth(1)).toContainText("Missing");
  await page.getByRole("button", { name: "Check figures" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "blank values are not zero",
  );
  await expect(page.getByRole("button", { name: "Calculate NOI" })).toHaveCount(
    0,
  );
});

test("unsupported files and non-T-12 types are refused plainly", async ({
  page,
}) => {
  await open(page);
  await page.locator(".dr-file").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "PDF and scanned documents are not supported",
  );
  await upload(page);
  await confirmType(page, "Rent Roll");
  await expect(
    page.locator("#dr-figures-title").locator("..").locator(".."),
  ).toContainText("reads T-12 operating statements only");
});

test("Research Lab asks before any download and states model identity", async ({
  page,
}) => {
  const requests = await open(page);
  await page.goto(APP + "/#research-lab");
  const lab = page.locator("#research-lab");
  await expect(lab).toContainText("Generic public model");
  await expect(lab).toContainText("PropertyIQ research model");
  await expect(lab).toContainText("Not PropertyIQ's model");
  await expect(lab).toContainText(
    "No model loaded. Keyword rules work without one.",
  );
  await page.getByRole("radio", { name: /Generic Qwen3-0.6B/ }).check();
  const download = page.getByRole("button", { name: "Download and load" });
  await expect(download).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Download 579 MB from huggingface.co/ })
    .check();
  await expect(download).toBeEnabled();
  // Not clicked: this spec never downloads a model.
  expect(
    (await new AxeBuilder({ page }).include("#research-lab").analyze())
      .violations,
  ).toEqual([]);
  await noOverflow(page);
  await lab.screenshot({
    path: `docs/step18-2/research-lab-${test.info().project.name}.png`,
  });
  expect(
    requests.filter((u) =>
      /huggingface|hf\.co|:(8766|11434|3000|8080)\b/.test(u),
    ),
  ).toEqual([]);
});

test("homepage tool card opens the workspace and returns", async ({ page }) => {
  await page.goto(APP + "/");
  const entry = page.getByRole("button", { name: /Document assistant/ });
  await expect(entry).toBeVisible();
  // Third card in "Or start with a tool"; one row of three on desktop, stacked on phones.
  const cards = page.locator(".iq-other-modes > button");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2)).toHaveText(/Document assistant/);
  const tops = await cards.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)),
  );
  if (test.info().project.name === "desktop")
    expect(new Set(tops).size).toBe(1);
  else expect(new Set(tops).size).toBe(3);
  expect(await entry.evaluate((e) => getComputedStyle(e).position)).not.toBe(
    "fixed",
  );
  await expect(page.locator(".dr-entry, .local-ai")).toHaveCount(0);
  await shots(page, "home");
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#documents$/);
  await expect(
    page.getByRole("heading", { name: /Review an operating statement/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to PropertyIQ" }).click();
  await expect(entry).toBeFocused();
  // The search bar still works.
  await page.locator("#property-brief").fill("20 units at $1,500 per month");
  await expect(page.locator(".brief-preview")).toContainText("20");
});

test("without WebGPU the research model is not offered to load", async ({
  page,
}) => {
  await open(page);
  await page.goto(APP + "/#research-lab");
  const lab = page.locator("#research-lab");
  await expect(lab).toContainText("WebGPU");
  await expect(lab).toContainText("not trained from scratch");
  await expect(lab).toContainText("deterministic code");
  // The workflow projects run headless Chromium without WebGPU.
  await expect(lab).toContainText("Not available");
  await page
    .getByRole("radio", { name: /PropertyIQ research Qwen3-1.7B/ })
    .check();
  await expect(lab).toContainText("needs WebGPU");
  await expect(page.locator("#research-lab .button.primary")).toBeDisabled();
  // The keyword rules still answer instantly.
  await page.goto(APP + "/#documents");
  await upload(page);
  await expect(page.locator(".dr-suggestion").first()).toContainText("Unknown");
});

test("no model file is requested before explicit consent", async ({ page }) => {
  const requests = await open(page); // opens #documents
  await page.goto(APP + "/");
  await page.getByRole("button", { name: /Document assistant/ }).click();
  await page.goto(APP + "/#research-lab");
  await page.getByRole("radio", { name: /Generic Qwen3-0.6B/ }).check();
  await page
    .getByRole("radio", { name: /PropertyIQ research Qwen3-1.7B/ })
    .check();
  await page.waitForTimeout(500);
  // Only app files and the local availability check; nothing from a model host or weights.
  expect(
    requests.filter(
      (u) =>
        /huggingface|hf\.co|\.onnx|_data/.test(u) || !u.startsWith(APP + "/"),
    ),
  ).toEqual([]);
});
