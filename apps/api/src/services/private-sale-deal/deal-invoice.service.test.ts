import { describe, expect, it, vi } from "vitest";
import { makeDeal } from "./deal-fixtures.test-util.js";
import { DealInvoiceService } from "./deal-invoice.service.js";
import type { DealTransitionOutcome } from "./deal-transition.service.js";

function setup(over: { issue?: ReturnType<typeof vi.fn> | null; blocked?: boolean } = {}) {
  const deal = makeDeal();
  const transition = vi.fn(
    async (): Promise<DealTransitionOutcome> =>
      over.blocked
        ? { kind: "blocked", blockers: [{ code: "vat_treatment_not_chosen" }] }
        : { kind: "ok", deal },
  );
  const recordInvoiceReference = vi.fn(async () => undefined);
  const issuer = over.issue === null ? null : { issue: over.issue ?? vi.fn(async () => null) };
  return {
    service: new DealInvoiceService({
      transitions: { transition },
      finance: { recordInvoiceReference },
      issuer,
    }),
    transition,
    recordInvoiceReference,
    issuer,
  };
}

describe("DealInvoiceService", () => {
  it("invoices the deal with no reference while no finance system issues invoices", async () => {
    const { service, transition, recordInvoiceReference } = setup({ issue: null });
    const outcome = await service.issue({ dealId: "deal-1", actorUserId: "u-fin" });
    expect(outcome.kind).toBe("ok");
    expect(transition).toHaveBeenCalledWith("deal-1", "issue_invoice", { actorUserId: "u-fin" });
    expect(recordInvoiceReference).not.toHaveBeenCalled();
  });

  it("records the reference the finance system returns", async () => {
    const issue = vi.fn(async () => ({ externalReference: "INV-1042" }));
    const { service, recordInvoiceReference } = setup({ issue });
    const outcome = await service.issue({ dealId: "deal-1", actorUserId: "u-fin" });
    expect(recordInvoiceReference).toHaveBeenCalledWith("deal-1", "INV-1042");
    expect(outcome).toMatchObject({ kind: "ok", deal: { invoiceReference: "INV-1042" } });
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "PS-0001",
        vatTreatment: "margin_scheme",
        money: expect.objectContaining({ priceMinor: 4_800_000, netToSellerMinor: 4_055_000 }),
      }),
    );
  });

  it("does not call the finance system for a deal that cannot be invoiced", async () => {
    const issue = vi.fn();
    const { service } = setup({ issue, blocked: true });
    expect((await service.issue({ dealId: "deal-1", actorUserId: "u" })).kind).toBe("blocked");
    expect(issue).not.toHaveBeenCalled();
  });

  it("keeps the deal invoiced when the finance system fails, so the reference can follow", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const issue = vi.fn(async () => {
      throw new Error("down");
    });
    const { service, recordInvoiceReference } = setup({ issue });
    expect((await service.issue({ dealId: "deal-1", actorUserId: "u" })).kind).toBe("ok");
    expect(recordInvoiceReference).not.toHaveBeenCalled();
  });

  it("attaches a reference later, and never an empty one", async () => {
    const { service, recordInvoiceReference } = setup();
    await service.attachReference({ dealId: "deal-1", externalReference: " INV-9 " });
    expect(recordInvoiceReference).toHaveBeenCalledWith("deal-1", "INV-9");
    await expect(
      service.attachReference({ dealId: "deal-1", externalReference: " " }),
    ).rejects.toThrow();
  });
});
