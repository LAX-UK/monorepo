import type { Database } from "@auction/db";
import type { UnappliedMoneyReason } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { UnappliedMoneyHandlingService } from "./unapplied-money-handling.service.js";

const open = {
  reason: "invoice_already_paid" as UnappliedMoneyReason,
  paymentId: "pay-1",
  paymentGroupId: null,
  stripePaymentIntentId: "pi_2",
  stripeChargeId: "ch_2",
  stripeCustomerId: null,
  amountCents: 10_000,
  currency: "GBP",
  dedupeKey: "invoice_already_paid:pi_2",
  eventId: 1,
  receivedAt: new Date(),
};

function build(
  found: (Omit<typeof open, "paymentId"> & { paymentId: string | null }) | null = open,
  invoiceStatus: string | null = "captured",
) {
  const resolve = vi.fn().mockResolvedValue(undefined);
  const service = new UnappliedMoneyHandlingService({
    reader: { findOpen: vi.fn().mockResolvedValue(found) },
    payments: {
      findById: vi
        .fn()
        .mockResolvedValue(invoiceStatus === null ? null : { id: "pay-1", status: invoiceStatus }),
    },
    recorder: { resolve },
    transactionRunner: {
      runInTransaction: async (fn: (tx: Database) => Promise<unknown>) => fn({} as Database),
    } as never,
  });
  return { service, resolve };
}

const finance = { actorUserId: "staff-1", role: "staff", staffRoles: ["finance"] as const };

describe("UnappliedMoneyHandlingService.markHandled", () => {
  it("closes the task with the staff member and their reason", async () => {
    const { service, resolve } = build();
    const result = await service.markHandled({
      ...finance,
      dedupeKey: open.dedupeKey,
      reason: "Applied to invoice PAY-1234 by agreement with the buyer.",
    });
    expect(result.isOk()).toBe(true);
    expect(resolve).toHaveBeenCalledWith(expect.anything(), [open], {
      via: "staff",
      actorUserId: "staff-1",
      note: "Applied to invoice PAY-1234 by agreement with the buyer.",
    });
  });

  it("needs a reason, finance permission, and an open task", async () => {
    const short = await build().service.markHandled({ ...finance, dedupeKey: "k", reason: "ok" });
    expect(short._unsafeUnwrapErr().status).toBe(400);
    const client = await build().service.markHandled({
      actorUserId: "user-1",
      role: "client",
      staffRoles: undefined,
      dedupeKey: "k",
      reason: "Applied to another invoice for this buyer.",
    });
    expect(client._unsafeUnwrapErr().status).toBe(403);
    const gone = await build(null).service.markHandled({
      ...finance,
      dedupeKey: "k",
      reason: "Applied to another invoice for this buyer.",
    });
    expect(gone._unsafeUnwrapErr().status).toBe(409);
  });

  it.each([
    ["paid_not_recorded", "pending"],
    ["invoice_cancelled", "cancelled"],
  ] as const)("refuses to close %s money while its invoice is %s", async (reason, status) => {
    const { service, resolve } = build({ ...open, reason, dedupeKey: `${reason}:pi_2` }, status);
    const result = await service.markHandled({
      ...finance,
      dedupeKey: `${reason}:pi_2`,
      reason: "Applied to invoice PAY-1234 by agreement with the buyer.",
    });
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(result._unsafeUnwrapErr().message).toContain("Capture or reinstate");
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(["paid_not_recorded", "invoice_cancelled"] as const)(
    "refuses to close %s money when the task has no invoice id",
    async (reason) => {
      const { service, resolve } = build({ ...open, reason, paymentId: null });
      const result = await service.markHandled({
        ...finance,
        dedupeKey: `${reason}:pi_2`,
        reason: "Applied to invoice PAY-1234 by agreement with the buyer.",
      });
      expect(result._unsafeUnwrapErr().status).toBe(409);
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it.each(["paid_not_recorded", "invoice_cancelled"] as const)(
    "refuses to close %s money when its invoice cannot be read",
    async (reason) => {
      const { service, resolve } = build({ ...open, reason }, null);
      const result = await service.markHandled({
        ...finance,
        dedupeKey: `${reason}:pi_2`,
        reason: "Applied to invoice PAY-1234 by agreement with the buyer.",
      });
      expect(result._unsafeUnwrapErr().status).toBe(409);
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it("still closes other reasons that carry no invoice id", async () => {
    const { service, resolve } = build({ ...open, paymentId: null }, null);
    const result = await service.markHandled({
      ...finance,
      dedupeKey: open.dedupeKey,
      reason: "Applied to invoice PAY-1234 by agreement with the buyer.",
    });
    expect(result.isOk()).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
