import { describe, expect, it, vi } from "vitest";
import { InvoiceDueDateExtender } from "./invoice-due-date-extender.js";

const repo = (extendDueAt: ReturnType<typeof vi.fn>, ids: string[] = []) => ({
  extendDueAt,
  listUnpaidLiveInvoiceIds: vi.fn().mockResolvedValue(ids),
});

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
  const scope = { kind: "account", legalEntityId: "acct-1" } as const;
  const releasedAt = new Date("2026-11-10T14:00:00.000Z");

  it("gives every unpaid invoice of the scope the term counted from the release", async () => {
    const extendDueAt = vi.fn().mockResolvedValue(true);
    const invoices = repo(extendDueAt, ["inv-1", "inv-2"]);
    const tx = { marker: "tx" } as never;

    const moved = await new InvoiceDueDateExtender(invoices).extendOpenInvoices(
      scope,
      releasedAt,
      tx,
    );

    expect(moved).toBe(2);
    expect(invoices.listUnpaidLiveInvoiceIds).toHaveBeenCalledWith(scope, tx);
    const until = new Date("2026-11-17T23:59:59.999Z");
    expect(extendDueAt).toHaveBeenCalledWith("inv-1", until, tx);
    expect(extendDueAt).toHaveBeenCalledWith("inv-2", until, tx);
  });

  it("counts only the due dates that moved: one already due later keeps its date", async () => {
    const extendDueAt = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const moved = await new InvoiceDueDateExtender(
      repo(extendDueAt, ["inv-1", "inv-2"]),
    ).extendOpenInvoices(scope, releasedAt);
    expect(moved).toBe(1);
  });

  it("does nothing when the scope owes nothing", async () => {
    const extendDueAt = vi.fn();
    expect(
      await new InvoiceDueDateExtender(repo(extendDueAt)).extendOpenInvoices(scope, releasedAt),
    ).toBe(0);
    expect(extendDueAt).not.toHaveBeenCalled();
  });
});
