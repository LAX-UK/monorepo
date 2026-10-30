import { describe, expect, it } from "vitest";
import { renderConsignmentAgreementPdf } from "./consignment-agreement.pdf.js";

const base = {
  reference: "C-1042",
  workTitle: "Harbour at Dusk",
  sellerName: "Northbank Gallery",
  currency: "GBP",
  estimateLow: "3000.00",
  estimateHigh: "5000.00",
  reservePrice: "2800.00",
  commissionPercent: "15",
  relistReserveFloor: null,
  termsVersion: "conditions-of-business-part-c-v1",
  proposedAt: new Date("2026-11-01T10:00:00Z"),
  accepted: null,
};

describe("renderConsignmentAgreementPdf", () => {
  it("renders a PDF for an agreement waiting for acceptance", async () => {
    const pdf = await renderConsignmentAgreementPdf(base);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("renders an accepted agreement", async () => {
    const pdf = await renderConsignmentAgreementPdf({
      ...base,
      relistReserveFloor: "2000.00",
      accepted: { byName: "Maya Okafor", at: new Date("2026-11-02T14:10:00Z") },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
