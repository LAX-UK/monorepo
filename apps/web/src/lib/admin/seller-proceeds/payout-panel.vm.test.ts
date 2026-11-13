import { describe, expect, it } from "vitest";
import { OLD_RULE_PANEL_NOTE, buildPayoutPanel } from "./payout-panel.vm";
import { FIXTURE_OLD_RULE_PAYOUT_SALES, FIXTURE_PAYOUT_SALES } from "./seller-proceeds.fixture";

describe("buildPayoutPanel", () => {
  it("shows the stored totals and one line per sale with its rate and agreement", () => {
    const panel = buildPayoutPanel(FIXTURE_PAYOUT_SALES);
    expect(panel.oldRule).toBe(false);
    expect(panel.figures).toEqual([
      { label: "Hammer", value: "£82,759.66" },
      { label: "Commission", value: "£8,775.97" },
      { label: "VAT on commission", value: "£1,755.19" },
      { label: "Stripe fee", value: "£0.00" },
      { label: "Net", value: "£72,228.50" },
    ]);
    expect(panel.inPayoutLabel).toBe("3 sales");
    expect(panel.lines[1]).toMatchObject({
      lot: "Lot 12",
      hammer: "£25,000.00",
      rate: "Commission 12% · VAT 20%",
      net: "£21,400.00",
      rateSource: { kind: "agreement", reference: "C-1042" },
    });
    expect(panel.notInPayout).toEqual([
      expect.objectContaining({ lot: "Lot 21", reason: "No signed agreement", canRecord: true }),
    ]);
  });

  it("keeps an old-rule payout's figures and says so", () => {
    const panel = buildPayoutPanel(FIXTURE_OLD_RULE_PAYOUT_SALES);
    expect(panel.oldRule).toBe(true);
    expect(panel.oldRuleNote).toBe(OLD_RULE_PANEL_NOTE);
    expect(panel.figures.map((f) => f.label)).toEqual([
      "Gross",
      "Platform fee",
      "Stripe fee",
      "Net",
    ]);
    expect(panel.lines[0]).toMatchObject({
      hammer: "£1,250.00",
      rate: "Old fee £62.50",
      net: "£1,187.50",
    });
    expect(panel.inPayoutLabel).toBe("1 sale");
  });
});
