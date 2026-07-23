import { describe, expect, it } from "vitest";
import { buildPaymentsListPageModel } from "./build-payments-list-page-model";

describe("buildPaymentsListPageModel", () => {
  it("parses manual review queue mode", () => {
    const model = buildPaymentsListPageModel({ manualReview: "1" });
    expect(model.manualReviewQueue).toBe(true);
    expect(model.manualReviewQuery.manualReview).toBe(true);
  });

  it("builds manual review chip hrefs with reason filter", () => {
    const model = buildPaymentsListPageModel({
      manualReview: "1",
      manualReviewReason: "finance",
    });
    expect(model.manualReviewReasonFilter).toBe("finance");
    const financeChip = model.manualReviewReasonChipSpecs.find((c) => c.id === "mr-finance");
    expect(financeChip?.active).toBe(true);
    expect(financeChip?.href).toContain("manualReviewReason=finance");
  });

  it("marks status chip active when not in manual review", () => {
    const model = buildPaymentsListPageModel({ status: "captured" });
    const captured = model.statusChipSpecs.find((c) => c.id === "captured");
    expect(captured?.active).toBe(true);
    expect(model.manualReviewQueue).toBe(false);
  });

  it("builds search filter chips when q is set", () => {
    const model = buildPaymentsListPageModel({ q: "invoice-42" });
    expect(model.searchFilterChips).toHaveLength(1);
    expect(model.searchFilterChips[0]?.label).toContain("invoice-42");
    expect(model.hasListFilters).toBe(true);
  });

  it("provides export filters from status query", () => {
    const model = buildPaymentsListPageModel({ status: "pending" });
    expect(model.exportFilters).toEqual({ status: "pending" });
  });
});
