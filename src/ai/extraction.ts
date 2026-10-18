import type { RawTable } from "../data/rentRoll";

export type SourceRow = {
  row: number;
  field: string;
  value: string;
  original: string;
  unit: string;
  start: string;
  end: string;
  originalCell: {
    field: string;
    value: string;
    unit: string;
    start: string;
    end: string;
  };
};
export type Source = {
  name: string;
  sha256: string;
  sheet: string;
  rows: SourceRow[];
};
const names: Record<string, string> = {
  "gross potential rent": "gross_potential_rent_usd_annual",
  "vacancy rate": "vacancy_rate",
  "credit loss rate": "credit_loss_rate",
  concessions: "concessions_usd_annual",
  "other income": "other_income_usd_annual",
  "management fee": "management_fee_usd_annual",
  "management fee rate": "management_fee_rate_of_egi",
};
const normal = (s: string) => s.trim().toLowerCase();
const date = (value: unknown) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").trim();

export function extractRows(raw: RawTable): SourceRow[] {
  const headers = raw.headers.map(normal);
  const columns = [
    ["field", "line item"],
    ["value", "amount"],
    ["unit"],
    ["period_start", "period start"],
    ["period_end", "period end"],
  ].map((aliases) => headers.findIndex((h) => aliases.includes(h)));
  if (columns.some((i) => i < 0))
    throw new Error(
      "This narrow extractor requires Field (or Line Item), Value (or Amount), Unit, Period Start, Period End columns. Use existing worksheet mapping for other layouts.",
    );
  if (raw.rows.length > 100)
    throw new Error(
      "Use at most 100 source lines for reviewed NOI extraction.",
    );
  return raw.rows.map((row, i) => {
    const [field, value, unit, start, end] = columns.map((c) => date(row[c]));
    return {
      row: raw.rowNumbers[i],
      field: names[normal(field)] ?? field.trim(),
      value,
      original: value,
      unit,
      start,
      end,
      originalCell: { field, value, unit, start, end },
    };
  });
}

function numeric(text: string): string {
  const value = text.trim().replace(/^\$/, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))
    throw new Error(
      "Every amount must be explicit, nonnegative and unambiguous; blank values are not zero.",
    );
  const clean = value.replaceAll(",", "");
  if (!Number.isFinite(Number(clean)))
    throw new Error("Amount is out of range");
  return clean;
}
function annualPeriod(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    throw new Error("Supply explicit ISO period dates on every source row.");
  const first = new Date(start + "T00:00:00Z"),
    last = new Date(end + "T00:00:00Z");
  if (
    !Number.isFinite(+first) ||
    !Number.isFinite(+last) ||
    first.toISOString().slice(0, 10) !== start ||
    last.toISOString().slice(0, 10) !== end
  )
    throw new Error("Invalid source period date");
  const days = (+last - +first) / 86400000 + 1;
  if (days !== 365 && days !== 366)
    throw new Error(
      "Only explicit annual/T-12 periods of 365 or 366 days are supported; do not annualize partial statements.",
    );
}

export function reviewedInputs(rows: SourceRow[]) {
  if (!rows.length) throw new Error("No source rows");
  const result: Record<string, unknown> = {};
  const expenses: Record<string, string | { amount: string; period: "month" }> =
    {};
  const seen = new Set<string>();
  for (const row of rows) {
    annualPeriod(row.start, row.end);
    if (row.start !== rows[0].start || row.end !== rows[0].end)
      throw new Error(
        "Source financial periods disagree; reconcile them before calculating.",
      );
    if (seen.has(row.field.toLowerCase()))
      throw new Error(
        "Duplicate source field; reconcile it rather than double counting.",
      );
    seen.add(row.field.toLowerCase());
    const rate = [
      "vacancy_rate",
      "credit_loss_rate",
      "management_fee_rate_of_egi",
    ].includes(row.field);
    let value: unknown;
    if (rate) {
      const amount = Number(numeric(row.value));
      if (!["fraction", "percent"].includes(normal(row.unit)))
        throw new Error("Rates require explicit fraction or percent units.");
      value = normal(row.unit) === "percent" ? amount / 100 : amount;
      if (Number(value) > 1)
        throw new Error("Rates must be between 0 and 100 percent");
    } else {
      if (!["usd/year", "usd/month"].includes(normal(row.unit)))
        throw new Error("Money requires explicit USD/year or USD/month units.");
      const amount = numeric(row.value);
      value =
        normal(row.unit) === "usd/month" ? { amount, period: "month" } : amount;
    }
    if (row.field.startsWith("expense:")) {
      const name = row.field.slice(8).trim();
      if (!name || /management|mgmt/i.test(name))
        throw new Error(
          "Name each expense; put management in its separate fee field.",
        );
      expenses[name] = value as string | { amount: string; period: "month" };
    } else if (
      [
        ...Object.values(names),
        "gross_potential_rent_usd_annual",
        "management_fee_rate_of_egi",
      ].includes(row.field)
    )
      result[row.field] = value;
    else
      throw new Error(
        `Unsupported or ambiguous line item: ${row.field}. Use expense:name for explicit expense lines; do not include subtotal or NOI rows.`,
      );
  }
  for (const key of [
    "gross_potential_rent_usd_annual",
    "vacancy_rate",
    "credit_loss_rate",
    "concessions_usd_annual",
    "other_income_usd_annual",
  ])
    if (!(key in result)) throw new Error(`Missing ${key}; never assume zero.`);
  if (!Object.keys(expenses).length)
    throw new Error(
      "Supply explicit expense:name rows; missing expenses are not zero.",
    );
  const fixed = "management_fee_usd_annual" in result,
    rate = "management_fee_rate_of_egi" in result;
  if (fixed === rate)
    throw new Error(
      "Supply exactly one explicit management fee or management fee rate.",
    );
  result[fixed ? "management_fee_rate_of_egi" : "management_fee_usd_annual"] =
    null;
  result.operating_expenses_usd_annual = expenses;
  return result;
}

export function readTable(
  file: File,
): Promise<{ raw: RawTable; sheets: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../data/import.worker.ts", import.meta.url),
      { type: "module" },
    );
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("Spreadsheet parsing timed out"));
    }, 15000);
    worker.onmessage = (e) => {
      finish();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    worker.onerror = () => {
      finish();
      reject(new Error("Unable to parse this spreadsheet"));
    };
    worker.postMessage({ file, sheet: 1 });
  });
}
