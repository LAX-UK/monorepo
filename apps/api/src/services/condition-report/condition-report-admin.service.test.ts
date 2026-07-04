import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import type { ConditionReportRequestRow } from "../interfaces/condition-report.js";
import { NotificationFactory } from "../notification.factory.js";
import { ConditionReportAdminService } from "./condition-report-admin.service.js";
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

function adminServiceForMarkInProgress(
  reqRow: ConditionReportRequestRow,
  updatedRow?: ConditionReportRequestRow,
) {
  const updated = updatedRow ?? { ...reqRow, status: "in_progress" as const };
  const publish = vi.fn().mockResolvedValue(undefined);
  const requestRepo = {
    findById: vi.fn(async () => reqRow),
    updateById: vi.fn(async () => updated),
  } as unknown as IConditionReportRequestRepository;

  const ctx = createConditionReportContext({
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    requestRepo,
    lotRepo: { findById: vi.fn() } as unknown as ILotRepository,
    legalEntityRepository: null,
    domainEventSink: mockDomainEventSink(publish) as never,
    notificationDispatcher: null,
    notificationFactory: new NotificationFactory(),
  });

  return { svc: new ConditionReportAdminService(ctx), publish };
}

describe("ConditionReportAdminService.markInProgress", () => {
  it("moves pending request to in_progress", async () => {
    const pending = makeRequestRow({ id: "req-pending", status: "pending" });
    const { svc, publish } = adminServiceForMarkInProgress(pending);
    const result = await svc.markInProgress({ id: "req-pending", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("in_progress");
    }
    expect(publish).toHaveBeenCalledOnce();
  });

  it("is idempotent when already in progress", async () => {
    const inProgress = makeRequestRow({ id: "req-ip", status: "in_progress" });
    const { svc, publish } = adminServiceForMarkInProgress(inProgress);
    const result = await svc.markInProgress({ id: "req-ip", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("in_progress");
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects fulfilled requests", async () => {
    const fulfilled = makeRequestRow({ id: "req-done", status: "fulfilled" });
    const { svc } = adminServiceForMarkInProgress(fulfilled);
    const result = await svc.markInProgress({ id: "req-done", actorUserId: "staff-1" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("pending");
    }
  });
});

describe("ConditionReportAdminService.listForAdmin", () => {
  it("delegates to repository", async () => {
    const listForAdmin = vi.fn(async () => ({
      items: [
        {
          ...makeRequestRow({ id: "open-pending", status: "pending" }),
          lotTitle: "Vase",
          requesterEmail: "buyer@example.com",
        },
      ],
      total: 1,
    }));
    const ctx = createConditionReportContext({
      transactionRunner: {
        runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
      } as never,
      requestRepo: { listForAdmin } as unknown as IConditionReportRequestRepository,
      lotRepo: { findById: vi.fn() } as unknown as ILotRepository,
      legalEntityRepository: null,
      domainEventSink: null,
      notificationDispatcher: null,
      notificationFactory: new NotificationFactory(),
    });
    const svc = new ConditionReportAdminService(ctx);
    const result = await svc.listForAdmin({ status: "open", limit: 10, offset: 0 });
    expect(listForAdmin).toHaveBeenCalledWith({ status: "open", limit: 10, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("open-pending");
  });
});
