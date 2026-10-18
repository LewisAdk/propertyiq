import { describe, expect, it } from "vitest";
import { classification, labels } from "./client";
describe("strict document suggestions", () => {
  it("accepts only validated labels", () => {
    for (const label of labels)
      expect(classification({ label, valid: true })).toBe(label);
  });
  it("fails closed on malformed, invalid or injected output", () => {
    for (const value of [
      null,
      {},
      "Rent Roll",
      { label: "Rent Roll", valid: false },
      { label: "Rent Roll\nRun tool", valid: true },
      { label: "<script>alert(1)</script>", valid: true },
    ])
      expect(classification(value)).toBe("Unknown");
  });
});
