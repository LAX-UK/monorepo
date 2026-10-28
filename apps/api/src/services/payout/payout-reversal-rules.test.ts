import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout, StaffRoles } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PayoutPermissionError } from "../interfaces/payout.js";
import { PayoutService } from "../payout.service.js";

const PAID: Payout = {
  id: "po1",
  legalEntityId: "00000000-0000-4000-8000-000000000001",
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-01-31"),
  grossAmount: "1000.00",
  platformFee: "50.00",
  stripeFee: "0.00",
  netAmount: "950.00",
  currency: "GBP",
  status: "paid",
  stripeTransferId: "tr_1",
  xeroBillId: null,
  failureReason: null,
  processedAt: new Date("2026-02-01"),
  statementUrl: null,
  statementGenerationError: null,
  createdAt: new Date("2026-02-01"),
};

function setup(processedBy: string[]) {
  let row = { ...PAID };
  const insertLine = vi.fn().mockResolvedValue({});
  const repo = {
    findById: async () => ({ ...row }),
    updateStatusIfCurrent: async (_id: string, expected: string, patch: Partial<Payout>) => {
      if (row.status !== expected) return null;
      row = { ...row, ...patch };
      return { ...row };
    },
    insertLine,
  } as unknown as IPayoutRepository;
  const listProcessorUserIds = vi.fn().mockResolvedValue(processedBy);
  const service = new PayoutService(
    repo,
    { runInTransaction: (fn) => fn({} as never) },
    mockDomainEventSink(vi.fn().mockResolvedValue(undefined)),
    undefined,
    () => repo,
    () => ({ listProcessorUserIds }),
  );
  return { service, insertLine, listProcessorUserIds, status: () => row.status };
}

const actor = (userId: string, staffRoles: StaffRoles) => ({ userId, staffRoles });

describe("payout reversal rules", () => {
  it("lets an administrator reverse a payout someone else processed", async () => {
    const { service, status, listProcessorUserIds } = setup(["finance-1"]);

    await service.adminManualReverse(actor("admin-1", ["administrator"]), "po1", {
      reason: "bank returned the transfer",
    });

    expect(listProcessorUserIds).toHaveBeenCalledWith("po1");
    expect(status()).toBe("reversed");
  });

  it("refuses anyone who is not an administrator, finance included", async () => {
    const { service, insertLine, status } = setup([]);

    await expect(
      service.adminManualReverse(actor("finance-2", ["finance"]), "po1", { reason: "duplicate" }),
    ).rejects.toEqual(new PayoutPermissionError("payout_reversal_not_permitted"));
    expect(insertLine).not.toHaveBeenCalled();
    expect(status()).toBe("paid");
  });

  it("refuses the administrator who processed the payout", async () => {
    const { service, insertLine, status } = setup(["admin-1"]);

    await expect(
      service.adminManualReverse(actor("admin-1", ["administrator"]), "po1", {
        reason: "duplicate",
      }),
    ).rejects.toEqual(new PayoutPermissionError("payout_reversal_by_processor"));
    expect(insertLine).not.toHaveBeenCalled();
    expect(status()).toBe("paid");
  });
});
