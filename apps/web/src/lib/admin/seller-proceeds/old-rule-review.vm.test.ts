import { describe, expect, it } from "vitest";
import { OLD_RULE_CSV_COLUMNS, buildOldRuleRow, oldRuleCsvRow } from "./old-rule-review.vm";
import { FIXTURE_OLD_RULE_ROWS } from "./seller-proceeds.fixture";

const NOW = new Date("2026-11-13T12:00:00Z");
const [priced, unpriced] = FIXTURE_OLD_RULE_ROWS as [
  (typeof FIXTURE_OLD_RULE_ROWS)[number],
  (typeof FIXTURE_OLD_RULE_ROWS)[number],
];

describe("buildOldRuleRow", () => {
  it("sets what was paid beside what the agreement gives, with the signed difference", () => {
    expect(buildOldRuleRow(priced, NOW)).toMatchObject({
      paidOn: "Thu 1 Oct",
      seller: "Northbank Gallery Ltd",
      lot: "Lot 3",
      hammer: "£1,000.00",
      paid: "£1,187.50",
      agreementRate: "Commission 12%",
      agreementGives: "£856.00",
      difference: "−£331.50",
      agreementReference: "C-0988",
    });
  });

  it("says why no figure can be given", () => {
    expect(buildOldRuleRow(unpriced, NOW)).toMatchObject({
      agreementRate: "No signed agreement",
      agreementGives: null,
      difference: null,
    });
  });
});

describe("oldRuleCsvRow", () => {
  it("writes plain pounds and fixed dates, one value per column", () => {
    const row = oldRuleCsvRow(priced);
    expect(row).toHaveLength(OLD_RULE_CSV_COLUMNS.length);
    expect(row).toEqual([
      "1 Oct 2026",
      "Northbank Gallery Ltd",
      "3",
      "Lamplight, Bankside",
      "C-0988",
      "1000.00",
      "1250.00",
      "62.50",
      "1187.50",
      "856.00",
      "-331.50",
    ]);
    expect(oldRuleCsvRow(unpriced)[9]).toBe("No signed agreement");
  });
});
