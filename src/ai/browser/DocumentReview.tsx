import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Lock,
  RotateCcw,
} from "lucide-react";
import Brand from "../../ui/Brand";
import { labels, type Label } from "../client";
import { keywordLabel, validLabel } from "../classify";
import { extractRows, reviewedInputs, type SourceRow } from "../extraction";
import { incomeNoi, type NoiInputs, type NoiResult } from "../noi";
import { ACCEPT, readDocument, type LoadedDocument } from "./documents";
import { MODELS, type ModelId } from "./probe";
import ResearchLab from "./ResearchLab";
// The existing 4B assistant needs the local bridge, so it exists only in dev with VITE_LOCAL_AI=1.
const LocalAI =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_AI === "1"
    ? lazy(() => import("../LocalAI"))
    : null;
import { useModel } from "./useModel";
import "./workspace.css";

const usd = (v: string | number) =>
  Number(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
const kb = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

const FIELD_NAMES: Record<string, string> = {
  gross_potential_rent_usd_annual: "Gross potential rent",
  vacancy_rate: "Vacancy rate",
  credit_loss_rate: "Credit loss rate",
  concessions_usd_annual: "Concessions",
  other_income_usd_annual: "Other income",
  management_fee_usd_annual: "Management fee (fixed)",
  management_fee_rate_of_egi: "Management fee (rate of EGI)",
};
const fieldName = (f: string) =>
  FIELD_NAMES[f] ??
  (f.startsWith("expense:") ? `Expense · ${f.slice(8).trim()}` : f);

const TYPE_HELP: Record<Label, string> = {
  "Rent Roll": "Units or tenants with their rents",
  "T-12": "Twelve months of income and expenses",
  "Offering Memorandum": "Marketing package for an investment",
  Other: "A clearly different document",
  Unknown: "Not enough evidence to say",
};

type Suggestion = {
  model: ModelId;
  label: Label;
  raw: string;
  valid: boolean;
  ms: number;
};

function Step({
  n,
  title,
  done,
  locked,
  children,
  id,
}: {
  n: number;
  title: string;
  done?: boolean;
  locked?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <section
      className="dr-step"
      aria-labelledby={`${id}-title`}
      data-state={locked ? "locked" : done ? "done" : "open"}
    >
      <header className="dr-step-head">
        <span className="dr-step-n" aria-hidden="true">
          {done ? <CheckCircle2 size={18} /> : n}
        </span>
        <h2 id={`${id}-title`}>
          <span className="dr-visually-hidden">Step {n}: </span>
          {title}
        </h2>
      </header>
      {locked ? <p className="dr-locked">{locked}</p> : children}
    </section>
  );
}

export default function DocumentReview({ onBack }: { onBack: () => void }) {
  const model = useModel();
  const [doc, setDoc] = useState<LoadedDocument | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [drag, setDrag] = useState(false);
  const [pasted, setPasted] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState("");
  const [choice, setChoice] = useState<Label | null>(null);
  const [confirmedType, setConfirmedType] = useState<Label | null>(null);
  const [rows, setRows] = useState<SourceRow[] | null>(null);
  const [extractError, setExtractError] = useState("");
  const [prepared, setPrepared] = useState<NoiInputs | null>(null);
  const [checkError, setCheckError] = useState("");
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<NoiResult | null>(null);
  const [calcError, setCalcError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.location.hash === "#research-lab")
      document.getElementById("research-lab")?.scrollIntoView();
    else heading.current?.focus({ preventScroll: true });
  }, []);

  const keyword = doc ? keywordLabel(doc.text) : null;

  function invalidateFigures() {
    setPrepared(null);
    setApproved(false);
    setResult(null);
    setCheckError("");
    setCalcError("");
  }
  function resetFrom(next: LoadedDocument | null) {
    setDoc(next);
    setSuggestion(null);
    setSuggestError("");
    setChoice(null);
    setConfirmedType(null);
    setRows(null);
    setExtractError("");
    invalidateFigures();
  }

  async function accept(file: File | undefined) {
    if (!file) return;
    setFileError("");
    setReading(true);
    try {
      resetFrom(await readDocument(file));
    } catch (e) {
      resetFrom(null);
      setFileError(
        e instanceof Error ? e.message : "This file could not be read.",
      );
    } finally {
      setReading(false);
    }
  }

  async function applyPasted() {
    const text = pasted.trim();
    if (!text) return;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    setFileError("");
    resetFrom({
      name: "Pasted text",
      bytes: new Blob([text]).size,
      sha256: Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      kind: "text",
      text,
    });
  }

  async function suggest() {
    if (!doc) return;
    setSuggestError("");
    setSuggestion(null);
    const s = model.state;
    const id = s.kind === "ready" ? s.model : null;
    try {
      const out = await model.classify(doc.text);
      const label = validLabel(out.raw, out.eos);
      setSuggestion({
        model: id!,
        label,
        raw: out.raw.trim(),
        valid: label !== "Unknown" || out.raw.trim() === "Unknown",
        ms: out.ms,
      });
    } catch (e) {
      setSuggestError(
        e instanceof Error ? e.message : "The suggestion failed.",
      );
    }
  }

  function edit(
    index: number,
    key: "value" | "unit" | "start" | "end",
    value: string,
  ) {
    setRows((current) =>
      current!.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
    invalidateFigures();
  }

  const modelReady = model.state.kind === "ready";
  const typeLocked = !doc ? "Add a document first." : undefined;
  const figuresLocked = !confirmedType
    ? "Confirm the document type first."
    : confirmedType !== "T-12"
      ? `Figure review reads T-12 operating statements only. You confirmed “${confirmedType}”, so there is nothing to calculate.`
      : doc?.kind !== "table"
        ? "Figure review needs a CSV or XLSX file. Text is used for the type suggestion only."
        : undefined;
  const corrected =
    rows?.filter(
      (r) =>
        r.value !== r.original ||
        r.unit !== r.originalCell.unit ||
        r.start !== r.originalCell.start ||
        r.end !== r.originalCell.end,
    ) ?? [];

  return (
    <div className="dr-page">
      <header className="topbar">
        <button
          className="brand"
          onClick={onBack}
          aria-label="Return to PropertyIQ"
        >
          <Brand />
        </button>
        <button className="button small" onClick={onBack}>
          <ArrowLeft size={16} /> Back to PropertyIQ
        </button>
      </header>

      <main className="dr-main" id="document-review">
        <div className="dr-intro">
          <h1 ref={heading} tabIndex={-1}>
            Review an operating statement{" "}
            <span className="dr-chip" data-tone="suggestion">
              Experimental
            </span>
          </h1>
          <p className="dr-lede">
            Add a T-12 export. PropertyIQ suggests the document type, you
            confirm it, review every figure against its source row, and approve
            before the deterministic NOI calculation runs.
          </p>
          <p className="dr-local">
            <Lock size={15} aria-hidden="true" /> Files are read in this
            browser. Nothing is uploaded.
          </p>
        </div>

        <ol className="dr-progress" aria-label="Progress">
          {["Document", "Type", "Figures", "Approval", "Result"].map(
            (name, i) => {
              const done = [
                !!doc,
                !!confirmedType,
                !!prepared,
                approved,
                !!result,
              ][i];
              return (
                <li key={name} data-done={done || undefined}>
                  <span>{i + 1}</span> {name}
                </li>
              );
            },
          )}
        </ol>

        <Step n={1} id="dr-upload" title="Add a document" done={!!doc}>
          <label
            className="dr-drop"
            data-drag={drag || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void accept(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept={ACCEPT}
              className="dr-file"
              aria-describedby="dr-formats"
              disabled={reading}
              onChange={(e) => {
                void accept(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <FileUp size={26} aria-hidden="true" />
            <span className="dr-drop-title">
              {reading
                ? "Reading file…"
                : doc
                  ? "Replace the document"
                  : "Drop a file here or browse"}
            </span>
            <span id="dr-formats" className="dr-drop-hint">
              CSV or XLSX (first worksheet) for figure review · TXT for the type
              suggestion only · up to 5 MB. PDF and scans are not supported.
            </span>
          </label>
          {fileError && (
            <p role="alert" className="dr-alert dr-error">
              <AlertTriangle size={16} aria-hidden="true" /> {fileError}
            </p>
          )}
          <details className="dr-paste">
            <summary>Paste text instead</summary>
            <label>
              Document text
              <textarea
                rows={5}
                value={pasted}
                maxLength={20000}
                onChange={(e) => setPasted(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button small"
              disabled={!pasted.trim()}
              onClick={() => void applyPasted()}
            >
              Use this text
            </button>
          </details>
          {doc && (
            <dl className="dr-file-card" aria-label="Current document">
              <div>
                <dt>File</dt>
                <dd>{doc.name}</dd>
              </div>
              <div>
                <dt>Contents</dt>
                <dd>
                  {doc.kind === "table"
                    ? `Table · worksheet “${doc.sheet}” · ${doc.raw!.rows.length} rows`
                    : "Text"}{" "}
                  · {kb(doc.bytes)}
                </dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd>
                  <code title={doc.sha256}>{doc.sha256.slice(0, 16)}…</code>
                </dd>
              </div>
            </dl>
          )}
        </Step>

        <Step
          n={2}
          id="dr-type"
          title="Confirm the document type"
          done={!!confirmedType}
          locked={typeLocked}
        >
          <div className="dr-suggestions">
            <div className="dr-suggestion">
              <span className="dr-source">Keyword rules · deterministic</span>
              <span
                className="dr-chip"
                data-tone={keyword === "Unknown" ? "muted" : "info"}
              >
                {keyword}
              </span>
              <span className="dr-note">
                Looks for fixed phrases such as “rent roll”, “T-12” or “offering
                memorandum”.
              </span>
            </div>
            <div className="dr-suggestion">
              <span className="dr-source">
                On-device model ·{" "}
                {suggestion
                  ? MODELS[suggestion.model].title
                  : modelReady
                    ? MODELS[(model.state as { model: ModelId }).model].title
                    : "optional"}
              </span>
              {suggestion ? (
                <>
                  <span className="dr-chip" data-tone="suggestion">
                    {suggestion.label}
                  </span>
                  <span className="dr-note">
                    Suggestion, not verified ·{" "}
                    {(suggestion.ms / 1000).toFixed(1)} s
                    {!suggestion.valid &&
                      ` · the model did not give a valid label (it wrote “${suggestion.raw.slice(0, 80)}”), so this counts as Unknown`}
                  </span>
                </>
              ) : modelReady || model.state.kind === "busy" ? (
                <button
                  type="button"
                  className="button small"
                  disabled={model.state.kind === "busy"}
                  onClick={() => void suggest()}
                >
                  {model.state.kind === "busy"
                    ? "Reading the excerpt…"
                    : "Suggest a type"}
                </button>
              ) : (
                <span className="dr-note">
                  Load a model in the{" "}
                  <a
                    href="#research-lab"
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById("research-lab")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Research Lab
                  </a>{" "}
                  to get a second opinion. Not required.
                </span>
              )}
              {suggestError && (
                <span role="alert" className="dr-alert dr-error">
                  {suggestError}
                </span>
              )}
            </div>
          </div>
          {suggestion && keyword && suggestion.label !== keyword && (
            <p className="dr-alert dr-warn">
              <AlertTriangle size={16} aria-hidden="true" /> The keyword rules
              and the model disagree. Check the document yourself.
            </p>
          )}
          <fieldset className="dr-types">
            <legend>Your decision</legend>
            {labels.map((l) => (
              <label
                key={l}
                className="dr-type"
                data-checked={choice === l || undefined}
              >
                <input
                  type="radio"
                  name="dr-type"
                  value={l}
                  checked={choice === l}
                  onChange={() => {
                    setChoice(l);
                    setConfirmedType(null);
                    setRows(null);
                    setExtractError("");
                    invalidateFigures();
                  }}
                />
                <span>
                  <strong>{l}</strong>
                  <small>{TYPE_HELP[l]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="dr-actions">
            <button
              type="button"
              className="button primary"
              disabled={!choice || choice === confirmedType}
              onClick={() => setConfirmedType(choice)}
            >
              Confirm type
            </button>
            {confirmedType && (
              <span className="dr-confirmed" role="status">
                <CheckCircle2 size={16} aria-hidden="true" /> Confirmed by you:{" "}
                {confirmedType}
              </span>
            )}
          </div>
        </Step>

        <Step
          n={3}
          id="dr-figures"
          title="Review the figures"
          done={!!prepared}
          locked={doc ? figuresLocked : "Add a document first."}
        >
          {!rows ? (
            <>
              <p className="dr-note">
                Reads the layout Field · Value · Unit · Period Start · Period
                End. Blank values stay blank and are never treated as zero.
              </p>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  try {
                    setRows(extractRows(doc!.raw!));
                    setExtractError("");
                  } catch (e) {
                    setExtractError(
                      e instanceof Error ? e.message : "Extraction failed",
                    );
                  }
                }}
              >
                Extract figures
              </button>
              {extractError && (
                <p role="alert" className="dr-alert dr-error">
                  <AlertTriangle size={16} aria-hidden="true" /> {extractError}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="dr-table-wrap">
                <table className="dr-table">
                  <caption className="dr-visually-hidden">
                    Extracted figures with their source rows
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Original</th>
                      <th scope="col">Reviewed value</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Period</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const changed = corrected.includes(row);
                      return (
                        <tr key={row.row} data-changed={changed || undefined}>
                          <th scope="row" data-label="Field">
                            {fieldName(row.field)}
                            {changed && (
                              <span className="dr-chip" data-tone="edited">
                                Corrected
                              </span>
                            )}
                            {!row.original.trim() && (
                              <span className="dr-chip" data-tone="danger">
                                Missing
                              </span>
                            )}
                          </th>
                          <td data-label="Original" className="dr-num">
                            {row.original || (
                              <span className="dr-muted">blank</span>
                            )}
                          </td>
                          <td data-label="Reviewed value">
                            <input
                              aria-label={`Reviewed value, ${fieldName(row.field)}, row ${row.row}`}
                              inputMode="decimal"
                              value={row.value}
                              onChange={(e) => edit(i, "value", e.target.value)}
                            />
                          </td>
                          <td data-label="Unit">
                            <input
                              aria-label={`Unit, ${fieldName(row.field)}, row ${row.row}`}
                              value={row.unit}
                              onChange={(e) => edit(i, "unit", e.target.value)}
                            />
                          </td>
                          <td data-label="Period" className="dr-period">
                            <input
                              aria-label={`Period start, ${fieldName(row.field)}, row ${row.row}`}
                              value={row.start}
                              onChange={(e) => edit(i, "start", e.target.value)}
                            />
                            <span aria-hidden="true">to</span>
                            <input
                              aria-label={`Period end, ${fieldName(row.field)}, row ${row.row}`}
                              value={row.end}
                              onChange={(e) => edit(i, "end", e.target.value)}
                            />
                          </td>
                          <td data-label="Source" className="dr-muted">
                            {doc!.sheet} · row {row.row}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="dr-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    try {
                      setPrepared(reviewedInputs(rows) as NoiInputs);
                      setCheckError("");
                    } catch (e) {
                      setPrepared(null);
                      setCheckError(
                        e instanceof Error
                          ? e.message
                          : "These figures are incomplete.",
                      );
                    }
                  }}
                >
                  Check figures
                </button>
                {prepared && (
                  <span className="dr-confirmed" role="status">
                    <CheckCircle2 size={16} aria-hidden="true" /> Figures are
                    complete and consistent
                  </span>
                )}
              </div>
              {checkError && (
                <p role="alert" className="dr-alert dr-error">
                  <AlertTriangle size={16} aria-hidden="true" /> {checkError}
                </p>
              )}
            </>
          )}
        </Step>

        <Step
          n={4}
          id="dr-approve"
          title="Approve the inputs"
          done={approved}
          locked={prepared ? undefined : "Check the figures first."}
        >
          {prepared && (
            <>
              <dl className="dr-summary">
                {(
                  [
                    [
                      "Gross potential rent",
                      prepared.gross_potential_rent_usd_annual,
                    ],
                    [
                      "Vacancy rate",
                      `${(prepared.vacancy_rate * 100).toFixed(2)}%`,
                    ],
                    [
                      "Credit loss rate",
                      `${(prepared.credit_loss_rate * 100).toFixed(2)}%`,
                    ],
                    ["Concessions", prepared.concessions_usd_annual],
                    ["Other income", prepared.other_income_usd_annual],
                    [
                      "Management fee",
                      prepared.management_fee_rate_of_egi !== null
                        ? `${(prepared.management_fee_rate_of_egi * 100).toFixed(2)}% of EGI`
                        : prepared.management_fee_usd_annual!,
                    ],
                    ...Object.entries(
                      prepared.operating_expenses_usd_annual,
                    ).map(([k, v]) => [`Expense · ${k}`, v] as const),
                  ] as const
                ).map(([name, v]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd className="dr-num">
                      {typeof v === "string"
                        ? /%/.test(v)
                          ? v
                          : `${usd(v)} / year`
                        : `${usd(v.amount)} / month`}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="dr-note">
                Period {rows![0].start} to {rows![0].end} · {doc!.name} ·{" "}
                {corrected.length
                  ? `${corrected.length} corrected ${corrected.length === 1 ? "row" : "rows"}`
                  : "no corrections"}
              </p>
              <label className="dr-approve">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => {
                    setApproved(e.target.checked);
                    setResult(null);
                  }}
                />
                <span>
                  I checked these figures against the source document and
                  approve them for the NOI calculation.
                </span>
              </label>
              <p className="dr-note">
                Only your approval unlocks the calculation. Suggestions and
                document text cannot approve anything.
              </p>
              <button
                type="button"
                className="button primary"
                disabled={!approved}
                onClick={() => {
                  try {
                    setResult(incomeNoi(prepared));
                    setCalcError("");
                  } catch (e) {
                    setCalcError(
                      e instanceof Error
                        ? e.message
                        : "The calculation failed.",
                    );
                  }
                }}
              >
                Calculate NOI
              </button>
              {calcError && (
                <p role="alert" className="dr-alert dr-error">
                  {calcError}
                </p>
              )}
            </>
          )}
        </Step>

        <Step
          n={5}
          id="dr-result"
          title="Result"
          done={!!result}
          locked={result ? undefined : "Approve the inputs and calculate."}
        >
          {result && (
            <div className="dr-result" aria-live="polite">
              <div className="dr-kpi">
                <span>Annual net operating income</span>
                <strong data-testid="noi">{usd(result.noi)}</strong>
                <small>
                  Effective gross income {usd(result.egi)} · {rows![0].start} to{" "}
                  {rows![0].end} · calculated in this browser from your approved
                  inputs
                </small>
              </div>
              {result.warnings.map((w) => (
                <p key={w} className="dr-alert dr-warn">
                  <AlertTriangle size={16} aria-hidden="true" /> {w}
                </p>
              ))}
              <table className="dr-table dr-steps">
                <caption>How it was calculated</caption>
                <tbody>
                  {result.steps.map((s) => (
                    <tr key={s.name}>
                      <th scope="row">{s.name}</th>
                      <td className="dr-muted">{s.formula}</td>
                      <td className="dr-num">{usd(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {corrected.length > 0 && (
                <div>
                  <h3>Corrected inputs</h3>
                  <ul className="dr-list">
                    {corrected.map((r) => (
                      <li key={r.row}>
                        {fieldName(r.field)}, row {r.row}:{" "}
                        {r.original || "blank"} → <strong>{r.value}</strong>
                        {r.unit !== r.originalCell.unit &&
                          ` (unit ${r.originalCell.unit || "blank"} → ${r.unit})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="dr-audit">
                <summary>Audit trail</summary>
                <pre tabIndex={0} aria-label="Audit trail details">
                  {JSON.stringify(
                    {
                      calculation:
                        "income_noi (browser port of the PropertyIQ calculator, spec 1.5)",
                      document: {
                        name: doc!.name,
                        sha256: doc!.sha256,
                        worksheet: doc!.sheet,
                      },
                      type: {
                        confirmed_by_user: confirmedType,
                        keyword_rules: keyword,
                        model_suggestion: suggestion && {
                          model: MODELS[suggestion.model].title,
                          label: suggestion.label,
                          raw: suggestion.raw,
                        },
                      },
                      approved_by_user: approved,
                      inputs: prepared,
                      source_rows: rows!.map((r) => ({
                        row: r.row,
                        field: r.field,
                        original: r.originalCell,
                        reviewed: {
                          value: r.value,
                          unit: r.unit,
                          start: r.start,
                          end: r.end,
                        },
                      })),
                      steps: result.steps,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <button
                type="button"
                className="button small"
                onClick={() => resetFrom(null)}
              >
                <RotateCcw size={15} aria-hidden="true" /> Start over
              </button>
            </div>
          )}
        </Step>

        <ResearchLab model={model} />
        {LocalAI && (
          <section className="dr-assistant" aria-label="Local 4B assistant">
            <Suspense fallback={null}>
              <LocalAI />
            </Suspense>
          </section>
        )}
      </main>
    </div>
  );
}
