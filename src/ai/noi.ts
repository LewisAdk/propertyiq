// Browser port of realestate_calc.income_noi (ai-assistant services, spec 1.5).
// Exact decimal arithmetic on BigInt (scale 1e24), results rounded half-up to cents
// like the Python service. Input is the object built by reviewedInputs().
type Money = string | { amount: string; period: "month" };
export type NoiInputs = {
  gross_potential_rent_usd_annual: Money;
  vacancy_rate: number;
  credit_loss_rate: number;
  concessions_usd_annual: Money;
  other_income_usd_annual: Money;
  operating_expenses_usd_annual: Record<string, Money>;
  management_fee_rate_of_egi: number | null;
  management_fee_usd_annual: Money | null;
};

const S = 10n ** 24n;
function dec(text: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new Error(`Not a plain nonnegative decimal: ${text}`);
  const frac = (m[2] ?? "").slice(0, 24).padEnd(24, "0");
  return BigInt(m[1]) * S + BigInt(frac);
}
// Rates arrive as JS numbers (percent / 100); 15 significant digits recovers the typed decimal.
const rate = (r: number) => dec(r.toPrecision(15)); // e-notation (< 1e-6) is rejected by dec
const money = (m: Money) =>
  typeof m === "string" ? dec(m) : dec(m.amount) * 12n;
const mul = (a: bigint, b: bigint) => (a * b) / S;
// Half-up to cents, as Python's num(value, "usd").
function cents(v: bigint): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const c = (abs * 100n + S / 2n) / S;
  const s = `${c / 100n}.${String(c % 100n).padStart(2, "0")}`;
  return neg && c !== 0n ? `-${s}` : s;
}

export type NoiResult = {
  steps: { name: string; formula: string; value: string }[];
  noi: string;
  egi: string;
  warnings: string[];
};

export function incomeNoi(inp: NoiInputs): NoiResult {
  const gpr = money(inp.gross_potential_rent_usd_annual);
  const vac = mul(gpr, rate(inp.vacancy_rate));
  const cred = mul(gpr, rate(inp.credit_loss_rate));
  const egi =
    gpr -
    vac -
    cred -
    money(inp.concessions_usd_annual) +
    money(inp.other_income_usd_annual);
  const byRate = inp.management_fee_rate_of_egi !== null;
  if (byRate === (inp.management_fee_usd_annual !== null))
    throw new Error("Supply exactly one management fee form");
  const mgmt = byRate
    ? mul(egi, rate(inp.management_fee_rate_of_egi!))
    : money(inp.management_fee_usd_annual!);
  const named = Object.values(inp.operating_expenses_usd_annual).reduce(
    (sum, m) => sum + money(m),
    0n,
  );
  const opex = named + mgmt;
  const noi = egi - opex;
  const warnings = [
    ...(noi < 0n ? ["Net operating income is negative."] : []),
    ...(egi === 0n
      ? ["Effective gross income is zero; expense ratio is undefined."]
      : []),
  ];
  return {
    noi: cents(noi),
    egi: cents(egi),
    warnings,
    steps: [
      ["Gross potential rent", "annual", gpr],
      ["Vacancy loss", "GPR × vacancy rate", vac],
      ["Credit loss", "GPR × credit loss rate", cred],
      [
        "Effective gross income",
        "GPR − vacancy − credit loss − concessions + other income",
        egi,
      ],
      [
        "Management fee",
        byRate ? "EGI × management fee rate" : "fixed annual fee",
        mgmt,
      ],
      ["Named operating expenses", "sum of expense lines", named],
      ["Total operating expenses", "named expenses + management fee", opex],
      ["Net operating income", "EGI − total operating expenses", noi],
    ].map(([name, formula, value]) => ({
      name: name as string,
      formula: formula as string,
      value: cents(value as bigint),
    })),
  };
}
