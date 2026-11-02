# PropertyIQ

**A free tool that shows whether an apartment building is a good investment.** Paste a listing or upload a rent roll, and it works out the income, the loan, and the return. There is no account, and your files stay in your browser.

**[Open PropertyIQ](https://propertyiq.pages.dev/)** and choose **Try a sample** to explore a fictional deal.

Built by **Lewis Adkins** · NYU, B.A. Economics (expected 2030) · [lewisadkins@nyu.edu](mailto:lewisadkins@nyu.edu) · [LinkedIn](https://linkedin.com/in/lewisadkins)

![Start page: paste or upload a deal, one primary action, trust signals and quieter alternatives](docs/screenshots/start-desktop.png)

## In plain English

Before buying an apartment building, an investor needs to answer three questions: How much cash will it produce? Can that cash cover the loan? What will I earn if I sell in a few years? Those answers usually live in large, hard-to-check spreadsheets.

PropertyIQ gives the answers in the browser and shows how each number was calculated. It can also test what happens if rents fall, costs rise, or the sale price disappoints.

**Real-world use:** a principal at a real estate investment firm used PropertyIQ to screen a proposed 50-condo development and a 48-unit Illinois acquisition, which helped move them on to detailed Excel underwriting. PropertyIQ is built for this first-pass screening. It does not replace a full underwriting model.

## At a glance

| | |
|---|---|
| **What it does** | Analyzes apartment-building deals, from a five-minute check to a month-by-month plan |
| **Who it's for** | Small investors, analysts and students |
| **Built with** | React, TypeScript and Vite, hosted on Cloudflare Pages |
| **Cost and privacy** | Free, with no account or backend. Your data stays on your device |
| **How it's checked** | 275 regression tests and 199 cross-browser checks. Results are compared with separate Python calculations |

## Highlights and where to check them

| Capability | Where to see it |
|---|---|
| Loan sizing by LTV, DSCR and debt yield | [`src/finance/model.ts`](src/finance/model.ts), [methodology](METHODOLOGY.md#debt) |
| Levered IRR (the investor's annual return after the loan) | [`src/finance/irr.ts`](src/finance/irr.ts), [`src/advanced/returns.ts`](src/advanced/returns.ts) |
| Preferred-return and promote waterfall (how profit is split among partners) | [`src/advanced/engine/partners.ts`](src/advanced/engine/partners.ts) |
| Monte Carlo simulation (up to 500 randomized runs of a deal) | [`src/advanced/risk.ts`](src/advanced/risk.ts), [`RiskPanel`](src/advanced/RiskPanel.tsx) |
| Math benchmarked against independent Python `Decimal` models | [`scripts/decimal_benchmarks.py`](scripts/decimal_benchmarks.py), [methodology](METHODOLOGY.md#independent-benchmarks) |
| 450+ automated tests (275 regression + 199 browser) | [`src`](src), [`e2e`](e2e), [verification notes](TESTING.md), [CI workflow](.github/workflows) |
| Experimental on-device T-12 document-type suggester (LoRA fine-tuned Qwen3-1.7B on WebGPU) | [Deployment notes](docs/step18-2/DEPLOYMENT_READY.md), [ADR-0011](docs/adr/0011-browser-runtime-csp.md), [model](https://huggingface.co/AwesomeLewis64/propertyiq-qwen3-1.7b-research-onnx) |

## See it

![Quick analysis with annual returns and operating charts](docs/screenshots/quick-desktop.png)
![Monthly planner with the shared sample and eight headline metrics](docs/screenshots/monthly-desktop.png)
![Start page on a phone](docs/screenshots/start-mobile.png)
![Phone layout: deal summary first, with sections and assumptions folded behind one-line summaries](docs/screenshots/quick-mobile.png)

## Everything it can do

### Get started

- **Paste deal details** such as "$2.8M purchase; 20 units at $1,900/mo; 6.25% rate; 65% LTV" and see what was extracted before it is used.
- **Upload a file:** rent rolls and operating statements in CSV or XLSX.
- **Guided start** for buying, refinancing, or deciding whether to sell or hold.
- **Try a sample:** a fictional 20-unit deal, plus sample workbooks.
- **Check the inputs first:** setup defaults are editable, and inputs that start at zero (vacancy, management, CapEx) are flagged.

### Quick analysis: annual returns in minutes

- Holds of 3–10 years, with separate tax and insurance growth, capital inflation and optional tax reassessment at sale.
- IRR, equity multiple, cash-on-cash by year, DSCR, debt yield, operating income and sale proceeds.
- Loan sizing by LTV, DSCR or debt yield, using whichever limit is lowest.
- Interest-only periods, full amortization after interest-only by default, selectable original-term amortization, and 30/360 or actual/360 interest.
- Sensitivity table anchored to the going-in cap rate, with a target-return color scale, a labeled base case and a downside takeaway.
- Income-to-cash-flow bridge, one-assumption sensitivity tornado and capital recovery timeline.
- **Refinance check:** loan sizing by value and coverage, cash out, change in payment and DSCR, and months to repay closing costs.
- **Sell vs hold:** cash today against holding at your target return, return on equity and a break-even exit cap.
- **Saved investment criteria:** minimum return, Year 1 DSCR and cash-on-cash, and maximum equity, each shown as meets, misses or not enough information.
- Rent-roll import with a before/after list of changes and undo.

### Monthly planner: when timing matters

It has 19 tools, reachable through navigation, More tools and search by name or topic ("noi" finds every tool that shows NOI).

| Tool | What it does |
|---|---|
| **Property overview** | Eight headline metrics, including NOI, IRR, XIRR, equity multiple and DSCR |
| **Property report** | Printable report with capital recovery and distributions |
| **Units & leasing** | Unit-by-unit rents, renewals, renovations, vacancy and optional rent per sq ft |
| **Leasing & project calendar** | Lease, renovation and funding dates on one timeline |
| **Expense schedules** | Taxes, insurance, management, utilities and repairs, with reimbursements |
| **Development & budgets** | Construction and renovation budgets, draws, unit deliveries, sales pace and buyer deposits |
| **Monthly cash & funding** | Month-by-month cash, reserves, shortfalls, owner capital calls and distributions |
| **Debt & borrowing capacity** | Multiple loans, draws, refinancing, automatic borrowing capacity and a month-by-month debt audit |
| **Decision Lab** | Scenario comparison, renovation priorities, lender quotes, break-even dashboard with a "What breaks first?" ranking for rent, vacancy, costs and interest rate, investment criteria, and a maximum-offer calculator |
| **Stress & probabilities** | Sensitivity, combined downside stress and Monte Carlo simulation |
| **Investors & tax scenario** | Partner contributions and distributions, preferred return and promote waterfall, dated returns, and a user-defined tax scenario |
| **Workbook imports** | Map columns or cells from CSV and XLSX files |
| **Workbook reconciliation** | Compare the model with your own spreadsheet and see the differences |
| **Actuals & variance** | Budget against actual results by month, with an NOI variance bridge |
| **Detailed operating records** | Ledger-level income and expenses |
| **Evidence & diligence** | Attach source files and track a diligence and municipal approval checklist |
| **Assumptions & sources** | Assumption quality checks, market evidence and calculations linked to their sources |
| **Decisions & case study** | Deal decisions, milestones and a property case-study template |
| **Portfolio & backups** | Compare local projects, save revisions, back up and restore |

### Experimental document assistant

A five-step review of a T-12 (a property's last 12 months of income and expenses): upload, confirm the document type, review each figure against its source row, approve, and get a calculated NOI with an audit trail.

The type suggestion comes from keyword rules and, optionally, a small AI model fine-tuned with LoRA that runs on your own GPU after you consent to a 2.14 GB download. The model only makes suggestions: you confirm every one, and ordinary code does the math. It did not beat the keyword rules in testing, and text planted in a document can mislead it, so it stays labeled experimental.

### Reports, exports and accessibility

- Printable investment briefs and PDF output.
- Charts with keyboard and touch inspection, data tables, and PNG, SVG and CSV downloads.
- Local snapshots with last-saved and backup status, portable backups that include evidence files, and exact links to a project or tool.
- Example data stays labeled as fictional through edits, duplication and backups.
- Light and dark themes, phone layouts that show results before assumptions, and chart legends that do not rely on color alone.

## Terms in 30 seconds

| Term | Meaning |
|---|---|
| **Rent roll** | A list of a building's units and what each one pays |
| **T-12** | A property's income and expenses over the last 12 months |
| **NOI** (net operating income) | Income left after operating costs, before the loan |
| **Cap rate** | NOI divided by the property's price |
| **LTV** (loan-to-value) | The loan as a share of the property's value |
| **DSCR** (debt service coverage ratio) | NOI divided by the loan payments. 1.25x means $1.25 of income per $1 owed |
| **Debt yield** | NOI divided by the loan balance |
| **IRR** | The investor's annual return, accounting for when cash arrives |
| **Levered** | Measured after the loan |
| **Waterfall, preferred return, promote** | The partners' profit split: investors are paid a set return first (preferred), and the deal's sponsor gets an extra share of what's left (promote) |
| **Monte Carlo** | Running a deal many times with randomized assumptions to see the range of outcomes |

## How the math is validated

The fictional Maple Grove value-add sample has $254,732 Year 1 NOI, a 41.65% operating expense ratio, taxes equal to 2% of acquisition price, and an exit cap 62.5 bps above its going-in cap. Its calculated annual IRR is **14.17%**. These are illustrative assumptions, not a sourced market deal.

Independent 40-digit Python Decimal calculations provide literal benchmark expectations for debt payments, balances, operating income, sale proceeds and returns. Both engines receive identical assumptions in parity tests: annual NOI, debt payoff, net sale and annual cash-flow IRR reconcile. Monthly XIRR is **14.81%** because distributions arrive monthly and returns use actual dates; this difference is disclosed rather than hidden.

The latest full run passes **275 regression tests**. Finance coverage gates require at least 90% statements, lines and functions, and 80% branches. 199 browser checks pass across Chromium, Firefox and WebKit. They cover desktop and 390×844 narrow-screen flows, imports, edits, storage, routing, every monthly tool and serious axe accessibility violations. GitHub Actions repeats the checks on pushes and pull requests. See [verification evidence](TESTING.md) and [financial conventions](METHODOLOGY.md).

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

The document assistant is enabled in builds with `VITE_BROWSER_AI=1` and is off by default. See [docs/step18-2/DEPLOYMENT_READY.md](docs/step18-2/DEPLOYMENT_READY.md).

## Limitations

- Synthetic benchmarks do not replace reconciliation to real loan documents and underwriting workbooks.
- Annual IRR and dated monthly XIRR have different cash-flow timing. Tax, construction and investor scenarios rely on entered assumptions.
- Tax, waterfall and probability tools are simplified scenarios. Monte Carlo probabilities describe your chosen inputs, not observed market odds, and lender results are modeled capacity, not approval.
- Actual/360 models full calendar months with nominal scheduled principal; it does not infer lender stub periods or penny-rounding rules.
- Projects are stored locally; clearing browser data removes them. Export backups before changing devices.
- Chromium, Firefox and Playwright WebKit pass desktop and narrow-screen checks. These are automated browser tests, not physical-device certification. Actual Cloudflare response headers still require deployment checks.

[Methodology](METHODOLOGY.md) · [Deployment](DEPLOYMENT.md) · [Reconciliation](RECONCILIATION.md) · [Changelog](CHANGELOG.md) · [Contact](mailto:lewisadkins@nyu.edu) · [License (MIT)](LICENSE)
