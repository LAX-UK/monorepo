import type { IConditionReportRequestRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import type { ConditionReportRequestRow } from "../interfaces/condition-report.js";
import { NotificationFactory } from "../notification.factory.js";
import { ConditionReportBuyerService } from "./condition-report-buyer.service.js";
import { createConditionReportContext } from "./condition-report-context.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "user-buyer-1";

function makeRequestRow(
  overrides: Partial<{
    id: string;
    status: ConditionReportRequestRow["status"];
    createdAt: Date;
  }> = {},
): ConditionReportRequestRow {
  return {
    id: overrides.id ?? "req-1",
    lotId,
    requestedByUserId: userId,
    requestingLegalEntityId: null,
    status: overrides.status ?? "pending",
    requestNote: null,
    responseNote: null,
    responseAttachmentUploadId: null,
    fulfilledByUserId: null,
    fulfilledAt: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-02"),
  };
}

function buyerServiceWithRows(rows: ConditionReportRequestRow[]) {
  const requestRepo = {
    listByLotAndUser: vi.fn(async () => rows),
  } as unknown as IConditionReportRequestRepository;

  const ctx = createConditionReportContext({
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    requestRepo,
    lotRepo: { findById: vi.fn() } as unknown as ILotRepository,
    legalEntityRepository: null,
    domainEventSink: null,
    notificationDispatcher: null,
    notificationFactory: new NotificationFactory(),
  });

  return new ConditionReportBuyerService(ctx);
}

describe("ConditionReportBuyerService.findForBuyerOnLot", () => {
  it("returns open pending request over older fulfilled row", async () => {
    const svc = buyerServiceWithRows([
      makeRequestRow({
        id: "fulfilled-old",
        status: "fulfilled",
        createdAt: new Date("2026-01-01"),
      }),
      makeRequestRow({ id: "pending-new", status: "pending", createdAt: new Date("2026-01-03") }),
    ]);
    const row = await svc.findForBuyerOnLot({ userId, lotId });
    expect(row?.id).toBe("pending-new");
    expect(row?.status).toBe("pending");
  });

  it("returns most recent row when no open request", async () => {
    const svc = buyerServiceWithRows([
      makeRequestRow({ id: "declined-new", status: "declined", createdAt: new Date("2026-01-05") }),
      makeRequestRow({
        id: "fulfilled-old",
        status: "fulfilled",
        createdAt: new Date("2026-01-01"),
      }),
    ]);
    const row = await svc.findForBuyerOnLot({ userId, lotId });
    expect(row?.id).toBe("declined-new");
  });
});
