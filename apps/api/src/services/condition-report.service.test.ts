import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ConditionReportService } from "./condition-report.service.js";
import type { ConditionReportRequestRow } from "./interfaces/condition-report.js";
import { NotificationFactory } from "./notification.factory.js";

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

describe("ConditionReportService facade", () => {
  it("delegates findForBuyerOnLot to buyer service", async () => {
    const rows = [
      makeRequestRow({ id: "pending-new", status: "pending", createdAt: new Date("2026-01-03") }),
    ];
    const requestRepo = {
      listByLotAndUser: vi.fn(async () => rows),
    } as unknown as IConditionReportRequestRepository;

    const svc = new ConditionReportService(
      { runInTransaction: async (fn) => fn({} as never) } as ITransactionRunner,
      { findById: vi.fn() } as unknown as ILotRepository,
      null,
      null,
      null,
      new NotificationFactory(),
      requestRepo,
    );

    const row = await svc.findForBuyerOnLot({ userId, lotId });
    expect(row?.id).toBe("pending-new");
    expect(requestRepo.listByLotAndUser).toHaveBeenCalledWith(lotId, userId);
  });
});
