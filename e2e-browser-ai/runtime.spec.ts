import { chromium, expect, test, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// On-device model runs through the real Research Lab and type-suggestion UI.
// generic: public Qwen3-0.6B, cached in a persistent profile (Stage 1 download reused).
// research: PropertyIQ Qwen3-1.7B int8 export served by `vite preview` from
// PIQ_RESEARCH_MODEL_DIR; never stored in the browser (disk reserve).
const APP = "http://127.0.0.1:4198";
const MODEL_HOST = /^https:\/\/(huggingface\.co|[^/]+\.hf\.co)\//;
// Short path: Chromium Cache Storage fails under long Windows profile paths.
const profile =
  process.env.BROWSER_AI_PROFILE ?? join(tmpdir(), "piq-browser-ai");
const RESULTS = "docs/step18-2/runtime-results.json";
const results: Record<string, unknown> = existsSync(RESULTS)
  ? JSON.parse(readFileSync(RESULTS, "utf8"))
  : {};
const plan = JSON.parse(
  readFileSync("docs/step18-1/classification-plan.json", "utf8"),
).cases as { id: string; text: string; expected: string }[];
const fidelity = JSON.parse(
  readFileSync("docs/step18-2/stage2-fidelity.json", "utf8"),
);
const reference = new Map<string, string>(
  fidelity.int8.cases
    .filter((c: { id: string }) => c.id.startsWith("cls:"))
    .map((c: { id: string; ref_label: string }) => [
      c.id.slice(4),
      c.ref_label,
    ]),
);

async function launch(online: boolean) {
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--enable-unsafe-webgpu"],
    viewport: { width: 1440, height: 900 },
  });
  const requests: string[] = [];
  const aborted: string[] = [];
  const errors: string[] = [];
  context.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  context.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  // Everything except the app (and the public model host while online) is refused:
  // bridge 8766, Ollama 11434, Open WebUI 3000/8080 are unreachable from this page.
  // Only refused URLs are intercepted: routed responses are not streamed, and a
  // catch-all route stalls the 2.1 GB research weights.
  await context.route(
    (url) =>
      !url.href.startsWith(APP + "/") && !(online && MODEL_HOST.test(url.href)),
    (route) => {
      aborted.push(route.request().url());
      return route.abort();
    },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(APP + "/#research-lab");
  await expect(page.locator("#research-lab")).toBeVisible();
  return { context, page, requests, aborted, errors };
}

async function load(page: Page, model: RegExp, device: "webgpu" | "wasm") {
  await expect(page.getByRole("radio", { name: model })).toBeEnabled();
  await page.getByRole("radio", { name: model }).check();
  await page.getByLabel("Run on").selectOption(device);
  const consent = page.locator("#research-lab .dr-approve input");
  if (await consent.count()) await consent.check();
  await page.locator("#research-lab .button.primary").click();
  const status = page.getByTestId("lab-status");
  await expect(status).toHaveText(/^(Ready|Could not load)/, {
    timeout: 5 * 60_000,
  });
  return (await status.textContent())!;
}

async function suggest(page: Page, text: string) {
  const paste = page.locator(".dr-paste");
  if ((await paste.getAttribute("open")) === null)
    await paste.locator("summary").click();
  await paste.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Use this text" }).click();
  const start = Date.now();
  await page.getByRole("button", { name: "Suggest a type" }).click();
  const box = page.locator(".dr-suggestion").nth(1);
  await expect(
    box.locator('[data-tone="suggestion"], [role="alert"]'),
  ).toBeVisible({ timeout: 10 * 60_000 });
  return {
    label: await box
      .locator('[data-tone="suggestion"]')
      .textContent()
      .catch(() => null),
    note: await box.locator(".dr-note").textContent(),
    wallMs: Date.now() - start,
  };
}

// Samples GPU memory (MiB) while a block runs; null when nvidia-smi is unavailable.
async function gpuPeak<T>(run: () => Promise<T>) {
  let peak = 0;
  let base = Infinity;
  const smi = spawn("nvidia-smi", [
    "--query-gpu=memory.used",
    "--format=csv,noheader,nounits",
    "-lms",
    "500",
  ]);
  smi.stdout.on("data", (d: Buffer) =>
    d
      .toString()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((v) => {
        peak = Math.max(peak, Number(v));
        base = Math.min(base, Number(v));
      }),
  );
  smi.on("error", () => undefined);
  try {
    return { value: await run(), gpuMiB: peak ? { before: base, peak } : null };
  } finally {
    smi.kill();
  }
}

test.describe.configure({ mode: "serial", timeout: 90 * 60_000 });

test("generic model: WebGPU and WASM from the browser cache", async () => {
  const { context, page, requests, aborted, errors } = await launch(true);
  const runs = [];
  for (const device of ["webgpu", "wasm"] as const) {
    const ready = await load(page, /Generic Qwen3-0.6B/, device);
    runs.push({ device, ready, ...(await suggest(page, plan[2].text)) });
  }
  results.generic = {
    runs,
    modelHostRequests: requests.filter((u) => MODEL_HOST.test(u)).length,
    outside: requests.filter(
      (u) => !u.startsWith(APP + "/") && !MODEL_HOST.test(u),
    ),
    aborted,
    errors,
  };
  await context.close();
  expect(runs.every((r) => r.ready.startsWith("Ready"))).toBe(true);
  expect(aborted).toEqual([]);
});

test("generic model: reload with the internet blocked", async () => {
  const { context, page, requests, aborted, errors } = await launch(false);
  const ready = await load(page, /Generic Qwen3-0.6B/, "wasm");
  const s = await suggest(page, plan[0].text);
  results.genericOffline = { ready, ...s, aborted, errors };
  await context.close();
  expect(ready).toMatch(/^Ready.*from browser storage/);
  expect(requests.filter((u) => !u.startsWith(APP + "/"))).toEqual([]);
});

test("research model: 12 frozen cases on WebGPU, served by this site", async () => {
  const { context, page, requests, aborted, errors } = await launch(false);
  await expect(page.locator("#research-lab")).toContainText(
    "PropertyIQ research model",
  );
  const { value: ready, gpuMiB } = await gpuPeak(() =>
    load(page, /PropertyIQ research Qwen3-1.7B/, "webgpu"),
  );
  const cases = [];
  for (const c of plan) {
    const s = await suggest(page, c.text);
    cases.push({
      id: c.id,
      expected: c.expected,
      reference: reference.get(c.id),
      ...s,
    });
  }
  await page.locator("#dr-type-title").evaluate((e) => e.scrollIntoView());
  await page.screenshot({
    path: "docs/step18-2/suggestion-research-desktop.png",
  });
  results.research = {
    ready,
    gpuMiB,
    agreesWithFp16Reference: `${cases.filter((c) => c.label === c.reference).length}/${cases.length}`,
    correctVsExpected: `${cases.filter((c) => c.label === c.expected).length}/${cases.length}`,
    cases,
    outside: requests.filter((u) => !u.startsWith(APP + "/")),
    aborted,
    errors,
  };
  await context.close();
  expect(ready).toMatch(/^Ready/);
  expect(requests.filter((u) => !u.startsWith(APP + "/"))).toEqual([]);
});

// Measured once (results.researchWasm): loading the 2.1 GB model on WASM fails with
// std::bad_alloc, so the Lab offers the research model on WebGPU only.
test("research model: WASM is refused with an explanation", async () => {
  const { context, page, aborted } = await launch(false);
  await page
    .getByRole("radio", { name: /PropertyIQ research Qwen3-1.7B/ })
    .check();
  await expect(
    page.locator('#research-lab option[value="wasm"]'),
  ).toHaveAttribute("disabled", "");
  await expect(page.getByLabel("Run on")).toHaveValue("webgpu");
  results.researchWasmGate = { wasmOptionDisabled: true, aborted };
  await context.close();
});

test.afterAll(() =>
  writeFileSync(RESULTS, JSON.stringify(results, null, 2) + "\n"),
);
