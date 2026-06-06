import { describe, expect, it } from "vitest";
import { buildAdminDisputeTableRow } from "./admin-disputes-table.vm";

describe("buildAdminDisputeTableRow", () => {
  it("formats amount and reason labels", () => {
    const row = buildAdminDisputeTableRow({
      stripeDisputeId: "dp_1",
      paymentId: "pay-1",
      status: "open",
      amountCents: 12500,
      currency: "gbp",
      reason: "fraudulent",
      sellerLegalEntityId: "le-1",
      openedAt: "2026-01-01T10:00:00.000Z",
      closedAt: null,
      outcome: null,
      lotTitle: "Vase",
    });
    expect(row.amountLabel).toContain("125");
    expect(row.reasonLabel).toBe("Fraudulent");
    expect(row.lotTitle).toBe("Vase");
  });
});
