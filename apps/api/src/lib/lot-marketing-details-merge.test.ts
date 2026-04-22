import type { LotMarketingDetails } from "@auction/types";
import { describe, expect, it } from "vitest";
import { mergeLotMarketingDetailsPatch } from "./lot-marketing-details-merge.js";

describe("mergeLotMarketingDetailsPatch", () => {
  it("replaces managed keys and preserves estimate and imageAlts", () => {
    const current: LotMarketingDetails = {
      estimate: { low: "100", high: "200", currency: "USD" },
      imageAlts: ["alt0"],
      conditionReport: { summary: "old" },
      artistNote: "x",
    };
    const next = mergeLotMarketingDetailsPatch(current, {
      conditionReport: { summary: "new" },
      artistNote: null,
    });
    expect(next.estimate).toEqual(current.estimate);
    expect(next.imageAlts).toEqual(["alt0"]);
    expect(next.conditionReport).toEqual({ summary: "new" });
    expect("artistNote" in next).toBe(false);
  });

  it("null clears a section", () => {
    const current: LotMarketingDetails = {
      provenance: [{ note: "a" }],
      exhibitions: [{ venue: "V" }],
    };
    const next = mergeLotMarketingDetailsPatch(current, { provenance: null });
    expect(next.provenance).toBeUndefined();
    expect(next.exhibitions).toEqual([{ venue: "V" }]);
  });

  it("undefined in patch leaves key unchanged", () => {
    const current: LotMarketingDetails = { artistNote: "keep" };
    const next = mergeLotMarketingDetailsPatch(current, { conditionReport: { summary: "s" } });
    expect(next.artistNote).toBe("keep");
    expect(next.conditionReport).toEqual({ summary: "s" });
  });
});
