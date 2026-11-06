import { describe, expect, it, vi } from "vitest";
import { InvoiceDueDateExtender } from "./invoice-due-date-extender.js";

const repo = (
  extendDueAt: ReturnType<typeof vi.fn> = vi.fn(),
  extendUnpaidDueDates: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(0),
) => ({ extendDueAt, extendUnpaidDueDates });

describe("InvoiceDueDateExtender", () => {
  it("moves the due date to the term counted from the release (end of the London day, seven days on)", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(true);
    const moved = await new InvoiceDueDateExtender(repo(extendDueAt)).extendAfterHold(
      "inv-1",
      new Date("2026-11-10T14:00:00.000Z"),
    );
    expect(moved).toBe(true);
    expect(extendDueAt).toHaveBeenCalledWith(
      "inv-1",
      new Date("2026-11-17T23:59:59.999Z"),
      undefined,
    );
  });

  it("joins the transaction it is given", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(true);
    const tx = { marker: "tx" } as never;
    await new InvoiceDueDateExtender(repo(extendDueAt)).extendAfterHold(
      "inv-1",
      new Date("2026-11-10T14:00:00.000Z"),
      tx,
    );
    expect(extendDueAt).toHaveBeenCalledWith("inv-1", expect.any(Date), tx);
  });

  it("reports that nothing moved when the stored due date is already later", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(false);
    expect(
      await new InvoiceDueDateExtender(repo(extendDueAt)).extendAfterHold("inv-1", new Date()),
    ).toBe(false);
  });
});

describe("InvoiceDueDateExtender.extendOpenInvoices", () => {
  const scope = {
    kind: "account",
    legalEntityId: "acct-1",
    holdStartedAt: new Date("2026-11-01T09:00:00.000Z"),
  } as const;
  const releasedAt = new Date("2026-11-10T14:00:00.000Z");

  it("gives the unpaid invoices of the scope the term counted from the release, in one statement", async () => {
    const extendUnpaidDueDates = vi.fn().mockResolvedValue(2);
    const invoices = repo(vi.fn(), extendUnpaidDueDates);
    const tx = { marker: "tx" } as never;

    const moved = await new InvoiceDueDateExtender(invoices).extendOpenInvoices(
      scope,
      releasedAt,
      tx,
    );

    expect(moved).toBe(2);
    expect(extendUnpaidDueDates).toHaveBeenCalledTimes(1);
    expect(extendUnpaidDueDates).toHaveBeenCalledWith(
      scope,
      new Date("2026-11-17T23:59:59.999Z"),
      tx,
    );
    expect(invoices.extendDueAt).not.toHaveBeenCalled();
  });

  it("passes when the hold began, so debt that was overdue before it is left alone", async () => {
    const extendUnpaidDueDates = vi.fn().mockResolvedValue(0);
    await new InvoiceDueDateExtender(repo(vi.fn(), extendUnpaidDueDates)).extendOpenInvoices(
      scope,
      releasedAt,
    );
    expect(extendUnpaidDueDates.mock.calls[0]?.[0].holdStartedAt).toEqual(scope.holdStartedAt);
  });
});
