import type { LotMarketingDetails } from "@auction/types";
import { describe, expect, it } from "vitest";
import { formValuesToApiPatch, marketingDetailsToFormValues } from "./admin-lot-marketing-mappers";

describe("admin lot marketing mappers", () => {
  it("maps marketingDetails to form defaults (artist FK is no longer in this form)", () => {
    const md: LotMarketingDetails = {
      conditionReport: { summary: "S", details: "D", downloadUrl: "https://x.com/r.pdf" },
      provenance: [{ period: "2010", note: "N" }],
      exhibitions: [{ year: "2011", venue: "V", note: "E" }],
      artistNote: "A",
    };
    const v = marketingDetailsToFormValues(md);
    expect(v.estimate).toEqual({ low: "", high: "", currency: "GBP" });
    expect(v.conditionReport).toEqual({
      summary: "S",
      details: "D",
      downloadUrl: "https://x.com/r.pdf",
    });
    expect(v.provenance).toEqual([{ period: "2010", note: "N" }]);
    expect(v.exhibitions).toEqual([{ year: "2011", venue: "V", note: "E" }]);
    expect(v.artistNote).toBe("A");
  });

  it("produces null sections when empty (clear on save)", () => {
    const patch = formValuesToApiPatch({
      estimate: { low: "", high: "", currency: "GBP" },
      conditionReport: { summary: "", details: "", downloadUrl: "" },
      provenance: [],
      exhibitions: [],
      artistNote: "",
    });
    expect(patch).toEqual({
      estimate: null,
      conditionReport: null,
      provenance: null,
      exhibitions: null,
      artistNote: null,
    });
  });

  it("maps list entries and drops empty provenance notes", () => {
    const patch = formValuesToApiPatch({
      estimate: { low: "", high: "", currency: "" },
      conditionReport: { summary: "x", details: "", downloadUrl: "" },
      provenance: [
        { period: "", note: "  " },
        { period: "p", note: " real " },
      ],
      exhibitions: [{ year: "", venue: "Museum", note: "" }],
      artistNote: "note",
    });
    expect(patch.conditionReport).toEqual({ summary: "x" });
    expect(patch.provenance).toEqual([{ period: "p", note: "real" }]);
    expect(patch.exhibitions).toEqual([{ venue: "Museum" }]);
    expect(patch.artistNote).toBe("note");
  });

  it("maps estimate when low, high, and currency are set", () => {
    const patch = formValuesToApiPatch({
      estimate: { low: "1000.00", high: "2000.00", currency: "GBP" },
      conditionReport: { summary: "", details: "", downloadUrl: "" },
      provenance: [],
      exhibitions: [],
      artistNote: "",
    });
    expect(patch.estimate).toEqual({ low: "1000.00", high: "2000.00", currency: "GBP" });
  });
});
