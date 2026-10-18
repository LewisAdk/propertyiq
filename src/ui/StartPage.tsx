import { useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Paperclip,
  Play,
  ChartNoAxesColumnIncreasing,
  House,
  Calculator,
  X,
  ArrowLeft,
  Check,
  FileSpreadsheet,
  TriangleAlert,
  Compass,
  ShieldCheck,
  LayoutDashboard,
  CalendarRange,
  PenLine,
  FolderOpen,
  ScanSearch,
} from "lucide-react";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";
import StoryCard from "./StoryCard";
import { swap } from "./viewTransition";
import { documentAssistant, navigate } from "./routes";
import {
  briefExamples,
  extractBrief,
  sampleProject,
  setupProject,
  setupAnnual,
  type SetupValues,
  type WorkspaceLaunch,
} from "./startFlow";
import { calculate } from "../finance/model";
import type { Assumptions } from "../finance/types";
type Intent =
  | "overview"
  | "monthly"
  | "price"
  | "financing"
  | "refinance"
  | "sellhold";
// Guided start: what is being decided, then what kind of property.
type Guide = { step: 1 | 2; transaction?: "buy" | "refinance" | "sellhold" };
const liveLabels: Record<string, string> = {
  units: "units",
  rent: "total monthly rent",
  price: "purchase price",
  rate: "interest rate %",
  ltv: "LTV %",
  loan: "loan amount",
  expenses: "annual expenses",
};
const now = new Date();
const blank: SetupValues = {
  name: "",
  location: "",
  strategy: "acquisition",
  units: "",
  rent: "",
  price: "",
  expenses: "",
  loan: "",
  rate: "",
  start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  equity: "",
  exitCap: "",
  sellingCosts: "2.5",
  requiredReturn: "10",
  amortization: "30",
  maturity: "10",
  hold: "5",
};
export default function StartPage({
  onOpen,
  onAnnual,
}: {
  onOpen: (launch?: WorkspaceLaunch) => void;
  onAnnual: (a?: Assumptions, view?: "refinance" | "sellhold") => void;
}) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState(false);
  // Start page ↔ input review crossfade.
  const showReview = (next: boolean) => swap(() => setReview(next));
  const [guide, setGuide] = useState<Guide | null>(null);
  const showGuide = (next: Guide | null) => swap(() => setGuide(next));
  const [values, setValues] = useState<SetupValues>(blank);
  const [recognized, setRecognized] = useState<string[]>([]);
  const [intent, setIntent] = useState<Intent>("overview");
  const [fileError, setFileError] = useState("");
  const [moneyDrafts, setMoneyDrafts] = useState<Record<string, string>>({});
  const [hint, setHint] = useState(0);
  const nextHint = () => setHint((h) => (h + 1) % briefExamples.length);
  const live = extractBrief(description);
  const start = (
    next: Intent = "overview",
    strategy?: SetupValues["strategy"],
  ) => {
    const numbers = extractBrief(description);
    setValues({
      ...blank,
      ...(strategy ? { strategy } : {}),
      ...Object.fromEntries(
        Object.entries(numbers).map(([key, n]) => [key, String(n)]),
      ),
    });
    setMoneyDrafts({});
    setRecognized(Object.keys(numbers));
    setIntent(next);
    showReview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const update = (key: keyof SetupValues, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const field = (
    key: keyof SetupValues,
    label: string,
    opts: {
      type?: string;
      min?: number;
      max?: number;
      required?: boolean;
      placeholder?: string;
      help?: string;
    } = {},
  ) => (
    <label className="iq-setup-field" key={key}>
      <span>
        {label}
        {recognized.includes(key) && (
          <small>
            <Check size={12} /> From description
          </small>
        )}
      </span>
      <input
        aria-label={label}
        aria-describedby={opts.help ? `iq-help-${key}` : undefined}
        type={
          ["price", "rent", "expenses", "loan", "equity"].includes(key)
            ? "text"
            : (opts.type ?? "number")
        }
        inputMode={
          ["price", "rent", "expenses", "loan", "equity"].includes(key)
            ? "decimal"
            : undefined
        }
        value={
          ["price", "rent", "expenses", "loan", "equity"].includes(key) &&
          moneyDrafts[key] === undefined &&
          values[key]
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
              }).format(Number(values[key]))
            : (moneyDrafts[key] ?? values[key] ?? "")
        }
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() =>
          setMoneyDrafts((d) => {
            const next = { ...d };
            delete next[key];
            return next;
          })
        }
        onChange={(e) => {
          if (["price", "rent", "expenses", "loan", "equity"].includes(key))
            setMoneyDrafts((d) => ({ ...d, [key]: e.target.value }));
          update(
            key,
            ["price", "rent", "expenses", "loan", "equity"].includes(key)
              ? e.target.value.replace(/[$,\s]/g, "")
              : e.target.value,
          );
        }}
        min={opts.min}
        max={opts.max}
        step={key === "units" ? 1 : "any"}
        required={opts.required}
        placeholder={opts.placeholder}
      />
      {opts.help && (
        <em className="iq-setup-help" id={`iq-help-${key}`}>
          {opts.help}
        </em>
      )}
    </label>
  );
  // Same condition the form uses to choose the annual (Quick) path.
  const annualPath =
    !file &&
    (intent === "overview" ||
      intent === "refinance" ||
      intent === "sellhold") &&
    values.strategy === "acquisition";
  const existingOwner = intent === "refinance" || intent === "sellhold";
  return (
    <div className="iq-start">
      <a className="skip-link" href="#start-content">
        Skip to main content
      </a>
      <header className="iq-start-header">
        <button
          className="brand"
          aria-label="PropertyIQ home"
          onClick={() => {
            showReview(false);
            showGuide(null);
          }}
        >
          <Brand />
        </button>
        <nav aria-label="Start page">
          <a
            href="#how-it-works"
            onClick={() => {
              showReview(false);
              showGuide(null);
            }}
          >
            How it works
          </a>
          <button className="iq-header-pill" onClick={() => onOpen()}>
            Monthly planner <ArrowUpRight size={14} />
          </button>
          <ThemeToggle />
        </nav>
      </header>
      <main id="start-content">
        {review ? (
          <section className="iq-review">
            <button className="iq-text-link" onClick={() => showReview(false)}>
              <ArrowLeft size={16} /> Back to start
            </button>
            <h1>
              Check these before
              <br />
              you trust the returns.
            </h1>
            <p>
              Fix anything we misread and fill in what is missing. Every result
              is built from these numbers.
              {existingOwner &&
                (intent === "refinance"
                  ? " Enter today's value and your current loan; you will land on the Refinance check."
                  : " Enter today's value and your current loan; you will land on Sell vs hold.")}
            </p>
            <div className="iq-review-note">
              {recognized.length
                ? `${recognized.length} figures found using simple text matching.`
                : "No figures extracted. You can enter them below."}{" "}
              Every figure is editable. This step does not verify your
              assumptions.
            </div>
            <form
              className="iq-setup"
              onSubmit={(e) => {
                e.preventDefault();
                if (annualPath) {
                  const a = setupAnnual(values);
                  const errors = calculate(a).errors;
                  if (errors.length) {
                    setFileError(errors.join(" "));
                    return;
                  }
                  onAnnual(
                    a,
                    existingOwner
                      ? (intent as "refinance" | "sellhold")
                      : undefined,
                  );
                  return;
                }
                onOpen({
                  project: setupProject(values, description),
                  tab: file
                    ? "imports"
                    : intent === "price" || intent === "financing"
                      ? "decisionlab"
                      : intent === "monthly"
                        ? "monthly"
                        : "overview",
                  file: file ?? undefined,
                  decision:
                    intent === "price"
                      ? "breakeven"
                      : intent === "financing"
                        ? "lenders"
                        : undefined,
                });
              }}
            >
              <div className="iq-setup-title">
                <span>01</span>
                <div>
                  <h2>Property basics</h2>
                  <p>A name and starting point for your analysis.</p>
                </div>
              </div>
              <div className="iq-setup-grid">
                {field("name", "Property name", {
                  type: "text",
                  placeholder: "Optional · e.g. Riverside rental property",
                })}
                {field("location", "Location", {
                  type: "text",
                  placeholder: "City, state",
                })}
                <label className="iq-setup-field">
                  <span>What are you analyzing?</span>
                  <select
                    value={values.strategy}
                    onChange={(e) => update("strategy", e.target.value)}
                  >
                    <option value="acquisition">Rental acquisition</option>
                    <option value="existing">Existing rental property</option>
                    <option value="development-sale">
                      Development → unit sales
                    </option>
                    <option value="development-hold">
                      Development → rental hold
                    </option>
                  </select>
                </label>
                {field("units", "Number of units", {
                  required: true,
                  min: 1,
                  max: 500,
                })}
                {field("start", "Forecast starting month", {
                  type: "month",
                  required: true,
                })}
                {field(
                  "price",
                  values.strategy.startsWith("development")
                    ? "Land / acquisition cost ($)"
                    : existingOwner
                      ? "Value today ($)"
                      : "Purchase price ($)",
                  { min: 0 },
                )}
                {values.strategy === "existing" &&
                  field("equity", "As-of owner equity ($)", {
                    required: true,
                    min: 0,
                  })}
              </div>
              <div className="iq-setup-title">
                <span>02</span>
                <div>
                  <h2>Income and financing</h2>
                  <p>Property totals. Unit details and loan terms come next.</p>
                </div>
              </div>
              <div className="iq-setup-grid">
                {field("rent", "Total monthly rent ($)", { min: 0 })}
                {field("expenses", "Annual operating expenses ($)", { min: 0 })}
                {field("loan", "Opening loan balance / amount ($)", { min: 0 })}
                {field("rate", "Annual interest rate (%)", {
                  required: Number(values.loan) > 0,
                  min: 0,
                  max: 100,
                })}
              </div>
              {file && (
                <div className="iq-selected-file">
                  <FileSpreadsheet size={18} />
                  <span>{file.name} · ready for column mapping</span>
                </div>
              )}
              {annualPath ? (
                <section
                  className="iq-flagged"
                  aria-labelledby="iq-flagged-title"
                >
                  <h2 id="iq-flagged-title">
                    <TriangleAlert size={18} aria-hidden="true" />
                    These start at 0 and change your returns the most
                  </h2>
                  <p>
                    Leaving them at 0 assumes no vacancy, no management cost and
                    no capital spending. Enter your own estimates.
                  </p>
                  <div className="iq-setup-grid">
                    {field("vacancy", "Vacancy (% of rent)", {
                      min: 0,
                      max: 100,
                      placeholder: "0",
                    })}
                    {field("management", "Management fee (% of income)", {
                      min: 0,
                      max: 100,
                      placeholder: "0",
                    })}
                    {field("annualCapex", "Annual CapEx ($ per year)", {
                      min: 0,
                      placeholder: "0",
                    })}
                  </div>
                </section>
              ) : (
                <p className="iq-flagged-note">
                  <TriangleAlert size={16} aria-hidden="true" />
                  Vacancy, management and CapEx also start at 0 here. Set them
                  in the planner before relying on the returns.
                </p>
              )}
              <details className="iq-defaults-panel">
                <summary>
                  <h2>Assumptions we filled in</h2>
                </summary>
                <p>
                  Editable defaults · not verified against your deal. Unentered
                  dollar amounts start at $0. Collection loss, closing costs and
                  growth rates also start at zero; review them before relying on
                  returns.
                </p>
                <div className="iq-setup-grid">
                  {field(
                    "exitCap",
                    "Exit cap (%) · blank = going-in cap + 0.625%",
                    {
                      min: 0.001,
                      max: 100,
                      help: "The rate a buyer applies to NOI when you sell, so a higher exit cap means a lower sale price. Going-in cap is first-year NOI divided by price.",
                    },
                  )}
                  {field("sellingCosts", "Selling costs (%) · default 2.5%", {
                    min: 0,
                    max: 100,
                  })}
                  {field("requiredReturn", "Target return (%) · default 10%", {
                    min: 0,
                    max: 100,
                    help: "The yearly return you need for this deal to be worth doing. Results are compared against it.",
                  })}
                  {field("amortization", "Amortization years · default 30", {
                    min: 1,
                    max: 50,
                    help: "Years over which loan payments would pay the balance down to zero. Longer means lower payments.",
                  })}
                  {field("maturity", "Maturity years · default 10", {
                    min: 1,
                    max: 50,
                  })}
                  {field("hold", "Hold years · default 5", { min: 3, max: 10 })}
                </div>
                <p>
                  Interest-only (IO) means paying interest without principal;
                  full amortization starts after IO, and interest accrues at
                  30/360. No real-time market or tax data is used. Development
                  delivery dates need entry in the monthly planner.
                </p>
              </details>
              {fileError && <p role="alert">{fileError}</p>}
              <div className="iq-setup-footer">
                <span>Saved on this browser. No account needed.</span>
                <button className="button primary" type="submit">
                  {file ? "Continue to file mapping" : "Create analysis"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </section>
        ) : guide ? (
          <section className="iq-guided" aria-labelledby="iq-guided-title">
            <button
              className="iq-text-link"
              onClick={() => showGuide(guide.step === 2 ? { step: 1 } : null)}
            >
              <ArrowLeft size={16} />{" "}
              {guide.step === 2 ? "Back" : "Back to start"}
            </button>
            <p className="iq-guided-step">Step {guide.step} of 2</p>
            <h1 id="iq-guided-title">
              {guide.step === 1
                ? "What are you deciding?"
                : "What kind of property?"}
            </h1>
            <div className="iq-guided-options">
              {(guide.step === 1
                ? ([
                    [
                      "buy",
                      "Buy a property",
                      "Test an acquisition: returns, debt and sensitivity.",
                    ],
                    [
                      "refinance",
                      "Refinance a loan",
                      "See how much a new loan could pay out and when it pays back.",
                    ],
                    [
                      "sellhold",
                      "Sell or hold",
                      "Compare cash in hand today with keeping the property.",
                    ],
                  ] as const)
                : ([
                    [
                      "rental",
                      "Rental apartments",
                      "A building with a rent roll or a few rent figures. Annual analysis.",
                    ],
                    ...(guide.transaction === "buy"
                      ? ([
                          [
                            "development",
                            "A development",
                            "Construction or lease-up on a monthly timeline, in the Monthly planner.",
                          ],
                        ] as const)
                      : []),
                  ] as const)
              ).map(([id, title, text]) => (
                <button
                  key={id}
                  onClick={() => {
                    if (guide.step === 1)
                      return showGuide({
                        step: 2,
                        transaction: id as "buy" | "refinance" | "sellhold",
                      });
                    const t = guide.transaction;
                    swap(() => setGuide(null));
                    start(
                      t === "refinance"
                        ? "refinance"
                        : t === "sellhold"
                          ? "sellhold"
                          : "overview",
                      id === "development" ? "development-hold" : "acquisition",
                    );
                  }}
                >
                  <strong>{title}</strong>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="iq-hero">
              <h1>
                {/* Words sharpen in one after another; the key phrase lands last. */}
                {["Analyze", "cash", "flow"].map((word, i) => (
                  <span
                    className="iq-word"
                    style={{ "--i": i } as CSSProperties}
                    key={word}
                  >
                    {word}{" "}
                  </span>
                ))}
                <br />
                <span
                  className="iq-word iq-key"
                  style={{ "--i": 3 } as CSSProperties}
                >
                  and financing.
                </span>
              </h1>
              <p className="iq-hero-subtitle">
                Paste a multifamily listing or upload a rent roll to see income,
                debt coverage and returns. Free, private, in your browser.
              </p>
              <form
                className="iq-composer"
                onMouseEnter={nextHint}
                onSubmit={(e) => {
                  e.preventDefault();
                  start();
                }}
              >
                <label className="sr-only" htmlFor="property-brief">
                  Paste deal details
                </label>
                <textarea
                  id="property-brief"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste deal details"
                  rows={3}
                  onFocus={(e) => {
                    // Keyboard arrival gets a fresh example too; hover already advanced it.
                    if (!e.currentTarget.form?.matches(":hover")) nextHint();
                  }}
                />
                {!description && (
                  <button
                    type="button"
                    className="iq-composer-example"
                    onClick={() => setDescription(briefExamples[hint])}
                  >
                    Try “{briefExamples[hint]}”
                  </button>
                )}
                {file && (
                  <div className="iq-selected-file">
                    <FileSpreadsheet size={17} />
                    <span>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      aria-label="Remove selected file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                <div className="iq-composer-actions">
                  <label className="button iq-upload">
                    <Paperclip size={21} />
                    Upload a file
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      aria-label="Upload property spreadsheet"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setFileError("");
                        if (!f) return;
                        if (
                          !/\.(csv|xlsx)$/i.test(f.name) ||
                          f.size > 5 * 1024 * 1024
                        ) {
                          setFile(null);
                          setFileError("Choose a CSV or XLSX file up to 5 MB.");
                          return;
                        }
                        setFile(f);
                      }}
                    />
                  </label>
                  <span>Rent rolls · Operating statements · CSV / XLSX</span>
                  <button className="button primary iq-analyze" type="submit">
                    Start an analysis <ArrowRight size={20} />
                  </button>
                </div>
                {fileError && (
                  <p role="alert" className="iq-file-error">
                    {fileError}
                  </p>
                )}
              </form>
              <div className="brief-preview" aria-live="polite">
                {Object.entries(live).map(([key, n]) => (
                  <span key={key}>
                    {liveLabels[key] ?? key}: {n?.toLocaleString("en-US")}
                  </span>
                ))}
              </div>
              <ul
                className="iq-trust"
                aria-label="Privacy, a sample and validation"
              >
                <li>
                  <Check size={14} aria-hidden="true" />
                  Free, no account
                </li>
                <li>
                  <Check size={14} aria-hidden="true" />
                  Your files stay in this browser
                </li>
                <li>
                  <Play size={14} aria-hidden="true" />
                  <button onClick={() => onAnnual()}>Try a sample</button>
                </li>
                <li>
                  <ShieldCheck size={14} aria-hidden="true" />
                  <a href="#quick/methodology">How the math is validated</a>
                </li>
              </ul>
              <section className="iq-other" aria-labelledby="iq-other-title">
                <h2 id="iq-other-title">Or start with a tool</h2>
                <div className="iq-other-modes">
                  <button onClick={() => onAnnual()}>
                    <LayoutDashboard size={22} aria-hidden="true" />
                    <strong>Quick analysis</strong>
                    <span>Use when you want annual returns and debt.</span>
                  </button>
                  <button onClick={() => onOpen()}>
                    <CalendarRange size={22} aria-hidden="true" />
                    <strong>Monthly planner</strong>
                    <span>Use when timing matters: lease-up, renovations.</span>
                  </button>
                  {documentAssistant && (
                    <button
                      data-document-assistant
                      onClick={() => navigate("#documents")}
                    >
                      <ScanSearch size={22} aria-hidden="true" />
                      <strong>Document assistant</strong>
                      <span>
                        Experimental T-12 review that runs on your device.
                      </span>
                    </button>
                  )}
                </div>
                <div className="iq-other-more">
                  <button onClick={() => showGuide({ step: 1 })}>
                    <Compass size={18} aria-hidden="true" />
                    Guided start
                  </button>
                  <button
                    onClick={() => {
                      setDescription("");
                      setValues(blank);
                      setRecognized([]);
                      setIntent("overview");
                      showReview(true);
                    }}
                  >
                    <PenLine size={18} aria-hidden="true" />
                    Enter numbers manually
                  </button>
                  <button onClick={() => start("monthly")}>
                    <ChartNoAxesColumnIncreasing size={18} aria-hidden="true" />
                    Review cash flow
                  </button>
                  <button onClick={() => start("price")}>
                    <House size={18} aria-hidden="true" />
                    Check an asking price
                  </button>
                  <button onClick={() => start("financing")}>
                    <Calculator size={18} aria-hidden="true" />
                    Compare financing
                  </button>
                  <button onClick={() => onOpen()}>
                    <FolderOpen size={18} aria-hidden="true" />
                    Open saved workspace
                  </button>
                </div>
              </section>
            </section>
            <StoryCard
              onReport={() =>
                onOpen({ project: sampleProject(), tab: "report" })
              }
            />
          </>
        )}
      </main>
      <div className="iq-footer">
        <span>
          <Brand />
        </span>
        <p>Free, private, no account. Files stay in your browser.</p>
        <nav aria-label="Product" className="iq-footer-links">
          <button onClick={() => onAnnual()}>Quick analysis</button>
          <button onClick={() => onOpen()}>Monthly planner</button>
          <a href="#quick/methodology">Methodology</a>
          <button
            onClick={() => onOpen({ project: sampleProject(), tab: "report" })}
          >
            Sample monthly report
          </button>
          <a href="#privacy">Privacy</a>
        </nav>
      </div>
    </div>
  );
}
