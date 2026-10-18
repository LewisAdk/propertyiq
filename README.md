# PropertyIQ

PropertyIQ is a free, browser-local tool for understanding multifamily property cash flows and financing. Quick analysis turns acquisition, income and expense assumptions into annual returns, debt schedules and sensitivity tables. Monthly planner adds leasing, construction, refinancing, funding and investor scenarios. Built with React, TypeScript and Vite, it works without accounts, paid APIs or a backend. Uploaded workbooks stay in the browser.

**[Open PropertyIQ](https://propertyiq.pages.dev/)** — choose **Try a sample** to explore a fictional deal. The public site runs on Cloudflare Pages and automatically deploys updates from `main`. [Deployment settings and verification](DEPLOYMENT.md).

![Start page: paste or upload a deal, one primary action, trust signals and quieter alternatives](docs/screenshots/start-desktop.png)
![Start page on a phone](docs/screenshots/start-mobile.png)
![Quick analysis with annual returns and operating charts](docs/screenshots/quick-desktop.png)
![Monthly planner with the shared sample and eight headline metrics](docs/screenshots/monthly-desktop.png)
![Phone layout: deal summary first, with sections and assumptions folded behind one-line summaries](docs/screenshots/quick-mobile.png)

## Features

- Quick analysis with 3–10 year holds, separate tax/insurance growth, capital inflation and optional sale-tax reassessment.
- Full amortization after interest-only by default; selectable original-term amortization, 30/360 or actual/360 interest, and LTV/DSCR/debt-yield loan constraints.
- Sensitivity anchored to going-in cap rates, with a target-return color scale, labeled base case and a downside takeaway.
- Income-to-cash-flow bridge, configurable one-assumption sensitivity tornado and capital recovery timeline, with keyboard/touch inspection, data tables and PNG/SVG/CSV downloads.
- CSV/XLSX rent-roll import with a before/after change list and undo, local snapshots with last-saved and backup status, portable backups including evidence files, and printable investment briefs.
- Refinance check (loan sizing by value and coverage, cash out, payment and DSCR change, months to repay closing costs) and Sell vs hold (cash today vs the hold case at your target return, with a break-even exit cap), plus a guided start for buy, refinance or sell-or-hold questions.
- Saved investment criteria (minimum return, Year 1 DSCR and cash-on-cash, maximum equity) shown as meets, misses or not enough information; cash-on-cash by year in Quick analysis; and in the Monthly planner a maximum-offer calculator, a "What breaks first?" ranking for rent, vacancy, costs and interest rate, and optional rent per sq ft.
- Monthly leasing, expenses, capital budgets, debt, investor returns, actuals, decision tools, evidence and workbook reconciliation. All existing tools remain available through primary navigation, More tools and search.
- Editable setup defaults with the zero-start inputs (vacancy, management, CapEx) flagged, live extraction preview, exact project links, accessible chart legends that do not rely on color alone, and mobile results before assumptions.
- Experimental document assistant (only in builds with `VITE_BROWSER_AI=1`; off by default): a five-step T-12 review with keyword-rule and optional on-device model type suggestions, source-row review, explicit approval and a deterministic NOI. The optional model runs on the visitor's GPU (WebGPU) after consent and download. It suggests only, matches keyword rules on accuracy and can be misled by text in documents. See [docs/step18-2/DEPLOYMENT_READY.md](docs/step18-2/DEPLOYMENT_READY.md) and [ADR-0011](docs/adr/0011-browser-runtime-csp.md).

## How the math is validated

The fictional Maple Grove value-add sample has $254,732 Year 1 NOI, a 41.65% operating expense ratio, taxes equal to 2% of acquisition price, and an exit cap 62.5 bps above its going-in cap. Its calculated annual IRR is **14.17%**. These are illustrative assumptions, not a sourced market deal.

Independent 40-digit Python Decimal calculations provide literal benchmark expectations for debt payments, balances, operating income, sale proceeds and returns. Both engines receive identical assumptions in parity tests: annual NOI, debt payoff, net sale and annual cash-flow IRR reconcile. Monthly XIRR is **14.81%** because distributions arrive monthly and returns use actual dates; this difference is disclosed rather than hidden.

The latest full run passes **274 regression tests**. Finance coverage gates require at least 90% statements, lines and functions, and 80% branches. 199 browser checks pass across Chromium, Firefox and WebKit. They cover desktop and 390×844 narrow-screen flows, imports, edits, storage, routing, every monthly tool and serious axe accessibility violations. GitHub Actions repeats the checks on pushes and pull requests. See [verification evidence](TESTING.md) and [financial conventions](METHODOLOGY.md).

The included examples and sample workbooks are fictional. Their provenance persists through edits, duplication and backups. To check your own workbook, use the [mapping checklist and discrepancy template](RECONCILIATION.md); private project data stays in your browser.

## Run locally

Use Node.js 22.12 or later and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

To verify and build:

```sh
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

`pnpm preview` opens a built-site preview. Browser tests use the same security headers as the static deployment through `scripts/preview.mjs`. Reproduce the independent calculations with `python scripts/decimal_benchmarks.py`.

## Limitations

- Synthetic benchmarks do not replace reconciliation to real loan documents and underwriting workbooks.
- Annual IRR and dated monthly XIRR have different cash-flow timing. Tax, construction and investor scenarios rely on entered assumptions.
- Actual/360 models full calendar months with nominal scheduled principal; it does not infer lender stub periods or penny-rounding rules.
- Projects are stored locally; clearing browser data removes them. Export backups before changing devices.
- Chromium, Firefox and Playwright WebKit pass desktop and narrow-screen checks. These are automated browser tests, not physical-device certification. Actual Cloudflare response headers still require deployment checks.

[Methodology](METHODOLOGY.md) · [Deployment](DEPLOYMENT.md) · [Reconciliation](RECONCILIATION.md) · [Changelog](CHANGELOG.md) · [Contact](mailto:abc@gmail.com) · [License (MIT)](LICENSE)
