import { useState } from "react";
import { Card } from "../advanced/Controls";
import { labels, classification, request, type Label } from "./client";
import ExtractionReview from "./ExtractionReview";
import { readTable, type Source } from "./extraction";
import type { RawTable } from "../data/rentRoll";

export default function LocalAI() {
  const [text, setText] = useState("");
  const [label, setLabel] = useState<Label>("Unknown");
  const [confirmed, setConfirmed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [inputs, setInputs] = useState("");
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [device, setDevice] = useState<"cuda" | "cpu">("cuda");
  const [source, setSource] = useState<
    (Omit<Source, "rows"> & { raw: RawTable }) | null
  >(null);
  const [provenance, setProvenance] = useState<
    (Source & { manualInputEdits?: boolean }) | null
  >(null);
  const [status, setStatus] = useState("Ready");
  const audit = result ? JSON.parse(result) : null;
  function invalidate() {
    setInputs("");
    setApproved(false);
    setResult("");
    setProvenance(null);
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("Loading / working — please wait");
    try {
      await task();
      setStatus("Ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Local AI unavailable");
      setStatus(
        e instanceof Error && /busy/i.test(e.message)
          ? "Busy — use CPU fallback or retry when the active request finishes"
          : "Error — review the message and retry",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="local-ai" aria-label="Local AI prototype">
      <details>
        <summary>
          Local research prototype · document suggestions and assistant
        </summary>
        <p>
          Experimental local models. Documents and questions are sent only to
          your local computer. Suggestions and explanations are unverified; no
          changes are applied to your property analysis.
        </p>
        <p role="status">{status}</p>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <Card title="Document-type suggestion · repaired Qwen3-1.7B">
          <p>
            Upload text, CSV or XLSX, or paste a document excerpt. PDF upload
            and scanned documents/OCR are unsupported. Financial extraction
            supports only CSV/XLSX. Only the first 4,000 characters are
            classified.
          </p>
          <label>
            Document file{" "}
            <input
              type="file"
              accept=".txt,.csv,.xlsx"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                invalidate();
                setSource(null);
                setText("");
                setConfirmed(false);
                setLabel("Unknown");
                setNotice("");
                void run(async () => {
                  if (file.size > 5 * 1024 * 1024)
                    throw new Error("File limit is 5 MB");
                  let excerpt: string;
                  if (/\.(csv|xlsx)$/i.test(file.name)) {
                    const parsed = await readTable(file);
                    const digest = await crypto.subtle.digest(
                      "SHA-256",
                      await file.arrayBuffer(),
                    );
                    const sha256 = Array.from(new Uint8Array(digest), (b) =>
                      b.toString(16).padStart(2, "0"),
                    ).join("");
                    setSource({
                      name: file.name,
                      sha256,
                      sheet: parsed.sheets[0],
                      raw: parsed.raw,
                    });
                    excerpt = [
                      parsed.raw.headers,
                      ...parsed.raw.rows.slice(0, 30),
                    ]
                      .map((row) => row.map((v) => String(v ?? "")).join("\t"))
                      .join("\n");
                  } else if (/\.txt$/i.test(file.name))
                    excerpt = await file.text();
                  else throw new Error("Use TXT, CSV or XLSX");
                  setText(excerpt.slice(0, 4000));
                  setConfirmed(false);
                  setLabel("Unknown");
                  setNotice("");
                });
              }}
            />
          </label>
          <label>
            Document excerpt{" "}
            <textarea
              rows={6}
              maxLength={4000}
              value={text}
              disabled={busy}
              onChange={(e) => {
                setText(e.target.value);
                invalidate();
                setSource(null);
                setConfirmed(false);
                setLabel("Unknown");
                setNotice("");
              }}
            />
          </label>
          <label>
            Classification device{" "}
            <select
              value={device}
              disabled={busy}
              onChange={(e) => setDevice(e.target.value as "cuda" | "cpu")}
            >
              <option value="cuda">GPU · only when Ollama is idle</option>
              <option value="cpu">
                CPU fallback · slower, leaves existing assistant on GPU
              </option>
            </select>
          </label>
          <button
            className="button"
            disabled={busy || !text.trim()}
            onClick={() =>
              void run(async () => {
                setConfirmed(false);
                invalidate();
                setLabel("Unknown");
                const response = await request("classify", { text, device });
                const row = response.rows?.[0];
                setLabel(classification(row));
                setNotice(
                  row?.valid
                    ? "Model suggestion received. Review and confirm or correct it."
                    : "Model output was invalid or uncertain. Choose a type manually.",
                );
              })
            }
          >
            Suggest document type
          </button>
          <p role="status">{notice}</p>
          <label>
            Suggested type (editable){" "}
            <select
              value={label}
              disabled={busy}
              onChange={(e) => {
                setLabel(e.target.value as Label);
                setConfirmed(false);
                invalidate();
              }}
            >
              {labels.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={busy || !text.trim()}
            onClick={() => setConfirmed(true)}
          >
            Confirm document type
          </button>
          {confirmed && (
            <p role="status">
              Confirmed: {label}. Classification does not approve financial
              values.
            </p>
          )}
          {confirmed && source && (
            <fieldset disabled={busy}>
              <ExtractionReview
                key={source.sha256}
                source={source}
                onInvalidate={invalidate}
                onPrepared={(value, refs) => {
                  setInputs(JSON.stringify(value, null, 2));
                  setProvenance(refs);
                  setApproved(false);
                  setResult("");
                }}
              />
            </fieldset>
          )}
        </Card>
        <Card title="Property assistant · existing Qwen3-4B-Instruct">
          <label>
            Your question or document excerpt{" "}
            <textarea
              rows={3}
              maxLength={4000}
              value={question}
              disabled={busy}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={busy || !question.trim()}
            onClick={() =>
              void run(async () => {
                setAnswer("");
                const response = await request("chat", { question });
                if (typeof response.text !== "string")
                  throw new Error("Invalid assistant response");
                setAnswer(response.text);
              })
            }
          >
            Ask assistant
          </button>
          {answer && (
            <>
              <h4>AI explanation · unverified</h4>
              <pre className="local-ai-output">{answer}</pre>
            </>
          )}
        </Card>
        <Card title="Reviewed calculation · existing deterministic NOI service">
          <p>
            Upload and review supported financial rows above, or manually enter
            complete calculator input JSON after reviewing the source. Missing
            values must be supplied explicitly. AI responses never populate or
            approve these inputs. Existing PropertyIQ calculations remain
            separate.
          </p>
          <label>
            Reviewed inputs (annual USD, rates as decimals){" "}
            <textarea
              rows={6}
              value={inputs}
              disabled={busy}
              placeholder={'{"gross_potential_rent_usd_annual":96000,...}'}
              onChange={(e) => {
                setInputs(e.target.value);
                setProvenance((previous) =>
                  previous ? { ...previous, manualInputEdits: true } : null,
                );
                setApproved(false);
                setResult("");
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={approved}
              disabled={busy}
              onChange={(e) => {
                setApproved(e.target.checked);
                setResult("");
              }}
            />{" "}
            I reviewed every input against the source and approve this
            calculation.
          </label>
          <button
            className="button"
            disabled={busy || !approved || !inputs.trim()}
            onClick={() =>
              void run(async () => {
                setResult("");
                const response = await request("calculate", {
                  tool: "income-noi",
                  approved,
                  inputs_json: inputs,
                  provenance,
                });
                if (response.verified_calculation !== true)
                  throw new Error("Unverified calculator response");
                setResult(
                  JSON.stringify(
                    {
                      result: response.result,
                      provenance: response.provenance ?? null,
                    },
                    null,
                    2,
                  ),
                );
              })
            }
          >
            Calculate approved inputs
          </button>
          {result && (
            <>
              <h4>Verified deterministic calculation</h4>
              <p role="status">
                Annual NOI: $
                {Number(
                  audit.result.results.net_operating_income_usd_annual.value,
                ).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USD
              </p>
              {audit.provenance && (
                <p>
                  Source: {audit.provenance.name} ·{" "}
                  {audit.provenance.rows[0]?.start} to{" "}
                  {audit.provenance.rows[0]?.end}. Original source values and
                  reviewed corrections are retained below.
                </p>
              )}
              <details>
                <summary>
                  Inputs, calculation steps and source provenance
                </summary>
                <pre className="local-ai-output">{result}</pre>
              </details>
            </>
          )}
        </Card>
        {busy && (
          <p role="status">
            Local model working; model loading may take a few seconds…
          </p>
        )}
      </details>
    </section>
  );
}
