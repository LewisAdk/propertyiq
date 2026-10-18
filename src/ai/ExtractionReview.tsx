import { useState } from "react";
import {
  extractRows,
  reviewedInputs,
  type SourceRow,
  type Source,
} from "./extraction";
import type { RawTable } from "../data/rentRoll";

export default function ExtractionReview({
  source,
  onPrepared,
  onInvalidate,
}: {
  source: Omit<Source, "rows"> & { raw: RawTable };
  onPrepared: (inputs: object, provenance: Source) => void;
  onInvalidate: () => void;
}) {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(false);
  function update(index: number, key: keyof SourceRow, value: string) {
    setRows(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
    setPrepared(false);
    setError("");
    onInvalidate();
  }
  return (
    <section aria-label="Financial extraction review">
      <h3>Review source financial rows</h3>
      <p>
        Source: {source.name}, worksheet {source.sheet}. SHA-256:{" "}
        <code>{source.sha256}</code>
      </p>
      <p>
        Supported layout: Field, Value, Unit, Period Start, Period End. Use
        expense:name for separate expenses excluding management. Money: USD/year
        or USD/month; rates: fraction or percent. All rows require the same
        explicit annual period. Other layouts need existing worksheet mapping;
        this extractor does not infer missing figures.
      </p>
      <button
        className="button"
        onClick={() => {
          onInvalidate();
          setPrepared(false);
          try {
            setRows(extractRows(source.raw));
            setError("");
          } catch (e) {
            setRows([]);
            setError(e instanceof Error ? e.message : "Extraction failed");
          }
        }}
      >
        Extract financial rows
      </button>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {rows.map((row, i) => (
        <fieldset key={row.row}>
          <legend>
            Source row {row.row} · original value {row.original || "(missing)"}
          </legend>
          {(["field", "value", "unit", "start", "end"] as const).map((key) => (
            <label key={key}>
              {key} · row {row.row}
              <input
                value={row[key]}
                onChange={(e) => update(i, key, e.target.value)}
              />
            </label>
          ))}
        </fieldset>
      ))}
      {rows.length > 0 && (
        <button
          className="button"
          onClick={() => {
            try {
              onPrepared(reviewedInputs(rows), {
                name: source.name,
                sha256: source.sha256,
                sheet: source.sheet,
                rows,
              });
              setError("");
              setPrepared(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Incomplete inputs");
            }
          }}
        >
          Prepare reviewed calculator inputs
        </button>
      )}
      {prepared && (
        <p role="status">
          Inputs prepared with source references. Review the calculator JSON and
          explicitly confirm before calculation.
        </p>
      )}
    </section>
  );
}
