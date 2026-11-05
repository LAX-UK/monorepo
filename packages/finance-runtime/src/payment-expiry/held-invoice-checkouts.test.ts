import { describe, expect, it, vi } from "vitest";
import { HeldInvoiceCheckouts } from "./held-invoice-checkouts.js";

function build(eligibility: Record<string, "held" | "payable" | "refused">) {
  const closeAndRead = vi.fn().mockResolvedValue({ kind: "no_money" });
  const svc = new HeldInvoiceCheckouts({
    payments: {
      findForExpiry: vi.fn(async (id: string) => ({
        status: "pending",
        amountPence: 100,
        stripePaymentIntentId: `pi_${id}`,
        paymentGroupId: null,
        buyerLegalEntityId: "le",
      })),
      checkoutSessionIds: vi.fn(async (id: string) => [`cs_${id}`]),
    },
    provider: { closeAndRead },
    eligibility: {
      check: vi.fn(async ({ payerUserId }: { payerUserId: string }) => {
        const kind = eligibility[payerUserId] ?? "payable";
        return kind === "held"
          ? { kind: "held" as const, reason: "identity_verification_required" as const }
          : kind === "refused"
            ? { kind: "refused" as const, reason: "organisation_closed" as const }
            : { kind: "payable" as const };
      }),
    },
    listUnpaidWithCheckout: vi.fn(async () => [
      { id: "pay-held", payerUserId: "unverified", buyerLegalEntityId: "le-1" },
      { id: "pay-ok", payerUserId: "verified", buyerLegalEntityId: "le-2" },
    ]),
  });
  return { svc, closeAndRead };
}

describe("HeldInvoiceCheckouts", () => {
  it("closes the open checkout of a held invoice, sessions and intent", async () => {
    const { svc, closeAndRead } = build({});
    await svc.close("pay-held");
    expect(closeAndRead).toHaveBeenCalledWith({
      paymentId: "pay-held",
      paymentIntentId: "pi_pay-held",
      checkoutSessionIds: ["cs_pay-held"],
    });
  });

  it("the sweep closes only held invoices' checkouts, and can run again safely", async () => {
    const { svc, closeAndRead } = build({ unverified: "held", verified: "payable" });
    expect(await svc.sweep()).toEqual({ checked: 2, closed: 1 });
    expect(closeAndRead).toHaveBeenCalledTimes(1);
    expect(closeAndRead).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "pay-held" }));
    await svc.sweep();
    expect(closeAndRead).toHaveBeenCalledTimes(2);
  });
});
