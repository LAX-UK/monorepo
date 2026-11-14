import { describe, expect, it, vi } from "vitest";
import { HeldInvoiceCheckouts } from "./held-invoice-checkouts.js";

type Group = Awaited<
  ReturnType<ConstructorParameters<typeof HeldInvoiceCheckouts>[0]["listOpenGroupsWithCheckout"]>
>[number];

const group = (id: string, payer: string | null, memberPayers: string[]): Group => ({
  id,
  payerUserId: payer,
  buyerLegalEntityId: "le-g",
  stripeCheckoutSessionId: `cs_${id}`,
  stripePaymentIntentId: null,
  members: memberPayers.map((p, i) => ({
    paymentId: `${id}-m${i}`,
    payerUserId: p,
    buyerLegalEntityId: "le-g",
  })),
});

function build(eligibility: Record<string, "held" | "payable" | "refused">, groups: Group[] = []) {
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
    listOpenGroupsWithCheckout: vi.fn(async () => groups),
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
    expect(await svc.sweep()).toEqual({ checked: 2, closed: 1, groupsChecked: 0, groupsClosed: 0 });
    expect(closeAndRead).toHaveBeenCalledTimes(1);
    expect(closeAndRead).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "pay-held" }));
    await svc.sweep();
    expect(closeAndRead).toHaveBeenCalledTimes(2);
  });

  it("closes a Pay several checkout when any member invoice is held, and leaves payable groups", async () => {
    const { svc, closeAndRead } = build({ unverified: "held", verified: "payable" }, [
      group("grp-held-member", "verified", ["verified", "unverified"]),
      group("grp-ok", "verified", ["verified", "verified"]),
    ]);
    expect(await svc.sweep()).toMatchObject({ groupsChecked: 2, groupsClosed: 1 });
    expect(closeAndRead).toHaveBeenCalledWith({
      paymentId: "grp-held-member",
      paymentIntentId: null,
      checkoutSessionIds: ["cs_grp-held-member"],
    });
    expect(closeAndRead).not.toHaveBeenCalledWith(expect.objectContaining({ paymentId: "grp-ok" }));
  });

  it("closes a Pay several checkout whose payer is held, or no longer known", async () => {
    const { svc, closeAndRead } = build({ unverified: "held", verified: "payable" }, [
      group("grp-held-payer", "unverified", ["verified"]),
      group("grp-no-payer", null, ["verified"]),
    ]);
    expect(await svc.sweep()).toMatchObject({ groupsChecked: 2, groupsClosed: 2 });
    expect(closeAndRead).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "grp-held-payer" }),
    );
    expect(closeAndRead).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "grp-no-payer" }),
    );
  });
});
