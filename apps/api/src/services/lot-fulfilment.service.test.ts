import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { LotFulfilmentService } from "./lot-fulfilment.service.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fulfilmentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeFulfilmentRow(overrides: Partial<{ id: string; lotId: string; status: string }> = {}) {
  return {
    id: overrides.id ?? fulfilmentId,
    lotId: overrides.lotId ?? lotId,
    paymentId: "pay-1",
    status: overrides.status ?? "awaiting_release",
    carrier: null,
    trackingNumber: null,
    releaseApprovedByUserId: null,
    releaseApprovedAt: null,
    shippedAt: null,
    deliveredAt: null,
    collectedAt: null,
    collectedBy: null,
    addressSnapshot: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
  };
}

function thenable<T>(value: T) {
  return Object.assign(Promise.resolve(value), {
    where: vi.fn(async () => value),
  });
}

function serviceForListForAdmin(
  rows: Array<ReturnType<typeof makeFulfilmentRow> & { lotTitle: string | null }>,
  opts?: { total?: number; whereCalled?: { current: boolean } },
) {
  const whereCalled = opts?.whereCalled ?? { current: false };
  const total = opts?.total ?? rows.length;
  const statusRows = [{ status: "awaiting_release", n: total }];

  const db = {
    select: vi.fn((sel: { n?: unknown; status?: unknown }) => {
      if (sel && "n" in sel && "status" in sel) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              groupBy: vi.fn(() => thenable(statusRows)),
            })),
          })),
        };
      }
      if (sel && "n" in sel) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => thenable([{ n: total }])),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() =>
                  Object.assign(Promise.resolve(rows), {
                    where: vi.fn(async () => {
                      whereCalled.current = true;
                      return rows;
                    }),
                  }),
                ),
              })),
            })),
          })),
        })),
      };
    }),
  } as unknown as Database;

  return { svc: new LotFulfilmentService(db), whereCalled };
}

describe("LotFulfilmentService.listForAdmin", () => {
  it("maps lot titles onto fulfilment rows", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc } = serviceForListForAdmin([row]);
    const result = await svc.listForAdmin();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lotTitle).toBe("Blue vase");
    expect(result.items[0]?.lotId).toBe(lotId);
    expect(result.total).toBe(1);
  });

  it("applies search filter when q is provided", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc, whereCalled } = serviceForListForAdmin([row], { whereCalled: { current: false } });
    const result = await svc.listForAdmin({ q: "vase" });
    expect(whereCalled.current).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lotTitle).toBe("Blue vase");
  });

  it("applies search filter for UUID needles", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Matched lot" };
    const { svc, whereCalled } = serviceForListForAdmin([row]);
    await svc.listForAdmin({ q: lotId });
    expect(whereCalled.current).toBe(true);
  });

  it("returns paginated total and status counts", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc } = serviceForListForAdmin([row], { total: 42 });
    const result = await svc.listForAdmin({ limit: 10, offset: 0 });
    expect(result.total).toBe(42);
    expect(result.statusCounts.awaiting_release).toBe(42);
  });
});
