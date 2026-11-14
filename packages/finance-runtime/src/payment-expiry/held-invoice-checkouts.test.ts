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

function build(
  eligibility: Record<string, "held" | "payable" | "refused" | "throws">,
  groups: Group[] = [],
  closed: { kind: string; error?: string } = { kind: "no_money" },
) {
  const closeAndRead = vi.fn().mockResolvedValue(closed);
  const onFailure = vi.fn();
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
        if (kind === "throws") throw new Error("payment_buyer_account_not_found");
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
    onFailure,
  });
  return { svc, closeAndRead, onFailure };
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
    expect(await svc.sweep()).toEqual({
      checked: 2,
      closed: 1,
      groupsChecked: 0,
      groupsClosed: 0,
      notClosed: 0,
      failed: 0,
    });
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

  it("counts nothing as closed when the provider could not close it (no Stripe client)", async () => {
    const { svc, closeAndRead } = build(
      { unverified: "held", verified: "payable" },
      [group("grp-held", "unverified", ["unverified"])],
      { kind: "unknown", error: "stripe_not_configured" },
    );
    expect(await svc.sweep()).toEqual({
      checked: 2,
      closed: 0,
      groupsChecked: 1,
      groupsClosed: 0,
      notClosed: 2,
      failed: 0,
    });
    expect(closeAndRead).toHaveBeenCalledTimes(2);
  });

  it("counts a checkout the provider found already complete as closed (nothing left open)", async () => {
    const { svc } = build({ unverified: "held", verified: "payable" }, [], {
      kind: "paid",
    });
    expect(await svc.sweep()).toMatchObject({ closed: 1, notClosed: 0 });
  });

  it("one invoice or group that fails is reported and skipped; the rest of the sweep runs", async () => {
    const { svc, closeAndRead, onFailure } = build(
      { verified: "throws", unverified: "held", gone: "throws" },
      [group("grp-broken", "gone", ["gone"]), group("grp-held", "unverified", ["unverified"])],
    );
    expect(await svc.sweep()).toEqual({
      checked: 2,
      closed: 1,
      groupsChecked: 2,
      groupsClosed: 1,
      notClosed: 0,
      failed: 2,
    });
    expect(closeAndRead).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "pay-held" }));
    expect(closeAndRead).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "grp-held" }));
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "invoice", id: "pay-ok" }),
    );
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "group", id: "grp-broken" }),
    );
  });

  it("a close that throws is reported and the next candidate is still closed", async () => {
    const { svc, closeAndRead, onFailure } = build({ unverified: "held", verified: "held" });
    closeAndRead.mockRejectedValueOnce(new Error("stripe down"));
    expect(await svc.sweep()).toMatchObject({ checked: 2, closed: 1, failed: 1 });
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
