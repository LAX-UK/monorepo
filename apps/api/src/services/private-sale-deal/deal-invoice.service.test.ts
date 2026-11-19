import { describe, expect, it, vi } from "vitest";
import { makeDeal, recordingSink } from "./deal-fixtures.test-util.js";
import { DealInvoiceService } from "./deal-invoice.service.js";
import type { DealTransitionOutcome } from "./deal-transition.service.js";

/**
 * A transaction that keeps what was written only when it commits, so a test can see a move
 * undone: `committed` holds the deal's stage and reference after the last transaction.
 */
function setup(over: { issue?: ReturnType<typeof vi.fn> | null; blocked?: boolean } = {}) {
  const deal = makeDeal({ stage: "cleared" });
  const committed = { stage: deal.stage as string, invoiceReference: null as string | null };
  let pending = { ...committed };
  const transition = vi.fn(async (): Promise<DealTransitionOutcome> => {
    if (over.blocked) return { kind: "blocked", blockers: [{ code: "vat_treatment_not_chosen" }] };
    pending.stage = "invoiced";
    return { kind: "ok", deal: { ...deal, stage: "invoiced" } };
  });
  const recordInvoiceReference = vi.fn(async (_dealId: string, reference: string) => {
    pending.invoiceReference = reference;
  });
  const transactionRunner = {
    runInTransaction: async <T>(run: (tx: never) => Promise<T>): Promise<T> => {
      pending = { ...committed };
      const result = await run({} as never);
      Object.assign(committed, pending);
      return result;
    },
  };
  const issuer = over.issue === null ? null : { issue: over.issue ?? vi.fn(async () => null) };
  const scope = {
    deals: {} as never,
    events: recordingSink(),
    finance: { recordInvoiceReference },
  };
  return {
    service: new DealInvoiceService({
      transitions: { transition },
      transactionRunner,
      scopeForTx: () => scope,
      issuer,
    }),
    transition,
    recordInvoiceReference,
    committed,
    scope,
  };
}

describe("DealInvoiceService", () => {
  it("refuses to invoice while no finance system issues invoices, leaving the deal where it is", async () => {
    const { service, transition, recordInvoiceReference } = setup({ issue: null });
    const outcome = await service.issue({ dealId: "deal-1", actorUserId: "u-fin" });
    expect(outcome).toEqual({
      kind: "blocked",
      blockers: [{ code: "invoice_issuer_not_configured" }],
    });
    expect(service.blockers()).toEqual([{ code: "invoice_issuer_not_configured" }]);
    expect(transition).not.toHaveBeenCalled();
    expect(recordInvoiceReference).not.toHaveBeenCalled();
  });

  it("moves the deal and records the reference in the same transaction", async () => {
    const issue = vi.fn(async () => ({ externalReference: "INV-1042" }));
    const { service, transition, recordInvoiceReference, committed, scope } = setup({ issue });
    expect(service.blockers()).toEqual([]);

    const outcome = await service.issue({ dealId: "deal-1", actorUserId: "u-fin" });

    expect(transition).toHaveBeenCalledWith(
      "deal-1",
      "issue_invoice",
      { actorUserId: "u-fin" },
      scope,
    );
    expect(recordInvoiceReference).toHaveBeenCalledWith("deal-1", "INV-1042");
    expect(outcome).toMatchObject({
      kind: "ok",
      deal: { stage: "invoiced", invoiceReference: "INV-1042" },
    });
    expect(committed).toEqual({ stage: "invoiced", invoiceReference: "INV-1042" });
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "PS-0001",
        vatTreatment: "margin_scheme",
        money: expect.objectContaining({ priceMinor: 4_800_000, netToSellerMinor: 4_055_000 }),
      }),
    );
  });

  it("passes the version the person saw to the move", async () => {
    const issue = vi.fn(async () => ({ externalReference: "INV-1" }));
    const { service, transition } = setup({ issue });
    await service.issue({ dealId: "deal-1", actorUserId: "u-fin", expectedVersion: 4 });
    expect(transition).toHaveBeenCalledWith(
      "deal-1",
      "issue_invoice",
      { actorUserId: "u-fin", expectedVersion: 4 },
      expect.anything(),
    );
  });

  it("does not call the finance system for a deal that cannot be invoiced", async () => {
    const issue = vi.fn();
    const { service } = setup({ issue, blocked: true });
    expect((await service.issue({ dealId: "deal-1", actorUserId: "u" })).kind).toBe("blocked");
    expect(issue).not.toHaveBeenCalled();
  });

  it.each([
    ["returns no invoice", vi.fn(async () => null)],
    ["returns an empty reference", vi.fn(async () => ({ externalReference: "  " }))],
    [
      "fails",
      vi.fn(async () => {
        throw new Error("down");
      }),
    ],
  ])(
    "undoes the move when the finance system %s: the deal is never invoiced without a reference",
    async (_case, issue) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { service, recordInvoiceReference, committed } = setup({ issue });

      const outcome = await service.issue({ dealId: "deal-1", actorUserId: "u" });

      expect(outcome).toEqual({ kind: "blocked", blockers: [{ code: "invoice_not_issued" }] });
      expect(recordInvoiceReference).not.toHaveBeenCalled();
      expect(committed).toEqual({ stage: "cleared", invoiceReference: null });
    },
  );

  it("lets a failure to record the reference undo the move too", async () => {
    const issue = vi.fn(async () => ({ externalReference: "INV-7" }));
    const { service, recordInvoiceReference, committed } = setup({ issue });
    recordInvoiceReference.mockRejectedValueOnce(new Error("db down"));

    await expect(service.issue({ dealId: "deal-1", actorUserId: "u" })).rejects.toThrow("db down");
    expect(committed).toEqual({ stage: "cleared", invoiceReference: null });
  });
});
