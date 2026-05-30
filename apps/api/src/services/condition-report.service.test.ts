import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { ConditionReportService } from "./condition-report.service.js";
import type { ILotRepository } from "./interfaces/repositories.js";
import { NotificationFactory } from "./notification.factory.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "user-buyer-1";

function makeRequestRow(
  overrides: Partial<{
    id: string;
    status: string;
    createdAt: Date;
  }>,
) {
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

function serviceWithRows(rows: ReturnType<typeof makeRequestRow>[]) {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => rows),
          limit: vi.fn(async () => (rows[0] ? [rows[0]] : [])),
        })),
      })),
    })),
  } as unknown as Database;

  const lotRepo = { findById: vi.fn() } as unknown as ILotRepository;
  return new ConditionReportService(db, lotRepo, null, null, null, new NotificationFactory());
}

describe("ConditionReportService.findForBuyerOnLot", () => {
  it("returns open pending request over older fulfilled row", async () => {
    const svc = serviceWithRows([
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
    const svc = serviceWithRows([
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

describe("ConditionReportService notifications on decline", () => {
  it("dispatches condition_report_declined to requester", async () => {
    const reqRow = makeRequestRow({ id: "req-decline", status: "pending" });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const lotRow = { id: lotId, title: "Vase" };

    const tx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [reqRow]),
          })),
        })),
      })),
      transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    } as unknown as Database;

    const lotRepo = {
      findById: vi.fn().mockResolvedValue(lotRow),
    } as unknown as ILotRepository;

    const svc = new ConditionReportService(
      db,
      lotRepo,
      null,
      null,
      { dispatch } as never,
      new NotificationFactory(),
    );

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
