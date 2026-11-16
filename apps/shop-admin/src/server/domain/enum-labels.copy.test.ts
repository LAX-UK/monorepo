import { SHOP_REFUND_SOURCES } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { REFUND_SOURCE_LABELS, refundSourceLabel } from "./enum-labels.copy";

describe("refund source labels", () => {
  it.each(SHOP_REFUND_SOURCES)("labels %s in staff words, not the stored code", (source) => {
    const label = REFUND_SOURCE_LABELS[source];
    expect(label, `no label for refund source "${source}"`).toBeTruthy();
    expect(label).not.toMatch(/_/);
    expect(label.toLowerCase()).not.toBe(source.replaceAll("_", " "));
    expect(refundSourceLabel(source)).toBe(label);
  });

  it("has no labels for values that no longer exist", () => {
    expect(Object.keys(REFUND_SOURCE_LABELS).sort()).toEqual([...SHOP_REFUND_SOURCES].sort());
  });

  it("never shows an unknown code as it is stored", () => {
    expect(refundSourceLabel("manual_bank_transfer")).toBe("Other refund");
  });
});
