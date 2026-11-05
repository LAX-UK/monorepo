import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { UnappliedMoneyHandlingService } from "./unapplied-money-handling.service.js";

const open = {
  reason: "invoice_already_paid" as const,
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

function build(found: typeof open | null = open) {
  const resolve = vi.fn().mockResolvedValue(undefined);
  const service = new UnappliedMoneyHandlingService({
    reader: { findOpen: vi.fn().mockResolvedValue(found) },
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
});
