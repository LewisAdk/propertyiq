import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { incomeNoi, type NoiInputs } from "./noi";
import { reviewedInputs, type SourceRow } from "./extraction";

const fixtureRows = (): SourceRow[] =>
  readFileSync("docs/step18-1/noi-reviewed-fixture.csv", "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line, i) => {
      const [field, value, unit, start, end] = line.split(",");
      const names: Record<string, string> = {
        "gross potential rent": "gross_potential_rent_usd_annual",
        "vacancy rate": "vacancy_rate",
        "credit loss rate": "credit_loss_rate",
        concessions: "concessions_usd_annual",
        "other income": "other_income_usd_annual",
        "management fee": "management_fee_usd_annual",
      };
      const cell = { field, value, unit, start, end };
      return {
        row: i + 2,
        ...cell,
        field: names[field] ?? field,
        original: value,
        originalCell: cell,
      };
    });

describe("incomeNoi (port of realestate_calc.income_noi)", () => {
  it("matches the Step 18.1 live calculator results for the reviewed fixture", () => {
    const rows = fixtureRows();
    expect(incomeNoi(reviewedInputs(rows) as NoiInputs).noi).toBe("62400.00");
    rows[4] = { ...rows[4], value: "2500" }; // the reviewed correction in workflow-results.json
    expect(incomeNoi(reviewedInputs(rows) as NoiInputs).noi).toBe("62500.00");
  });

  it("matches the service schema example, rate fee and monthly amounts", () => {
    const base: NoiInputs = {
      gross_potential_rent_usd_annual: "230400",
      vacancy_rate: 0.08,
      credit_loss_rate: 0,
      concessions_usd_annual: "0",
      other_income_usd_annual: "9000",
      operating_expenses_usd_annual: {
        taxes: "18000",
        insurance: "19000",
        repairs: "9000",
        utilities: "7000",
        payroll: "8000",
      },
      management_fee_rate_of_egi: null,
      management_fee_usd_annual: "10598",
    };
    expect(incomeNoi(base).noi).toBe("149370.00");
    // 4% of EGI 220968 = 8838.72
    const byRate = incomeNoi({
      ...base,
      management_fee_rate_of_egi: 0.04,
      management_fee_usd_annual: null,
    });
    // Values below were returned by the live service (127.0.0.1:8000/v1/income-noi) on 2026-10-17.
    expect(byRate.steps.find((s) => s.name === "Management fee")!.value).toBe(
      "8838.72",
    );
    expect(byRate.noi).toBe("151129.28");
    expect(
      incomeNoi({
        ...base,
        gross_potential_rent_usd_annual: { amount: "19200", period: "month" },
      }).noi,
    ).toBe("149370.00");
    // 7.3% stays exact (no binary drift): 100000 x 0.073 = 7300.00
    expect(
      incomeNoi({
        ...base,
        gross_potential_rent_usd_annual: "100000",
        vacancy_rate: 0.073,
      }).steps[1].value,
    ).toBe("7300.00");
    expect(
      incomeNoi({
        ...base,
        gross_potential_rent_usd_annual: "100000",
        vacancy_rate: 0.073,
        other_income_usd_annual: "0",
        operating_expenses_usd_annual: { x: "1000" },
        management_fee_usd_annual: "0",
      }).noi,
    ).toBe("91700.00");
  });

  it("warns on negative NOI and rejects ambiguous fee forms", () => {
    const inp: NoiInputs = {
      gross_potential_rent_usd_annual: "1000",
      vacancy_rate: 0,
      credit_loss_rate: 0,
      concessions_usd_annual: "0",
      other_income_usd_annual: "0",
      operating_expenses_usd_annual: { taxes: "2000.005" },
      management_fee_rate_of_egi: null,
      management_fee_usd_annual: "0",
    };
    const r = incomeNoi(inp);
    expect(r.noi).toBe("-1000.01"); // half-up on -1000.005 magnitude, as Python ROUND_HALF_UP
    expect(r.warnings).toEqual(["Net operating income is negative."]);
    expect(() =>
      incomeNoi({ ...inp, management_fee_rate_of_egi: 0.1 }),
    ).toThrow();
  });
});
