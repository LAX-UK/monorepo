import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { IConditionReportRequestRepository } from "../../repositories/interfaces/condition-report-request.repository.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import type { ConditionReportRequestRow } from "../interfaces/condition-report.js";
import type { ILotRepository } from "../interfaces/repositories.js";
import { NotificationFactory } from "../notification.factory.js";
import { createConditionReportContext } from "./condition-report-context.js";
import { ConditionReportFulfilmentService } from "./condition-report-fulfilment.service.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "user-buyer-1";

function makeRequestRow(
  overrides: Partial<{ id: string; status: ConditionReportRequestRow["status"] }> = {},
): ConditionReportRequestRow {
  return {
    id: overrides.id ?? "req-decline",
    lotId,
    requestedByUserId: userId,
    requestingLegalEntityId: null,
    status: overrides.status ?? "pending",
    requestNote: null,
    responseNote: null,
    responseAttachmentUploadId: null,
    fulfilledByUserId: null,
    fulfilledAt: null,
    createdAt: new Date("2026-01-02"),
  };
}

describe("ConditionReportFulfilmentService notifications on decline", () => {
  it("dispatches condition_report_declined to requester", async () => {
    const reqRow = makeRequestRow({ id: "req-decline", status: "pending" });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const lotRow = { id: lotId, title: "Vase" };

    const tx = {};
    const db = {
      transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    } as unknown as Database;

    const requestRepo = {
      findById: vi.fn(async () => reqRow),
      updateById: vi.fn(async () => ({ ...reqRow, status: "declined" as const })),
    } as unknown as IConditionReportRequestRepository;

    const lotRepo = {
      findById: vi.fn().mockResolvedValue(lotRow),
    } as unknown as ILotRepository;

    const ctx = createConditionReportContext({
      transactionRunner: transactionRunnerFromDb(db),
      requestRepo,
      lotRepo,
      legalEntityRepository: null,
      domainEventSink: null,
      notificationDispatcher: { dispatch } as never,
      notificationFactory: new NotificationFactory(),
    });

    const svc = new ConditionReportFulfilmentService(ctx);
    const result = await svc.decline({
      id: "req-decline",
      fulfilledByUserId: "staff-1",
      responseNote: "Unavailable",
    });

    expect(result.isOk()).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]?.[0]).toBe(userId);
    const payload = dispatch.mock.calls[0]?.[1] as { type?: string };
    expect(payload.type).toBe("condition_report_declined");
  });
});
