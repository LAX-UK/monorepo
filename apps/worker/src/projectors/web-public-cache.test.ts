import { describe, expect, it, vi } from "vitest";
import { WEB_PUBLIC_CACHE_PROJECTOR, processWebPublicCache } from "./web-public-cache.js";

const LOT = "0b8f0c1e-7c39-4a1c-9d1f-1f0f6a2b3c4d";
const SALE = "11111111-1111-4111-8111-111111111111";

function setup(cursor: number, rows: Array<Record<string, unknown>>) {
  const projectorStateRepo = {
    ensureCursor: vi.fn(),
    getCursor: vi.fn().mockResolvedValue(cursor),
    advanceCursor: vi.fn(),
    advanceCursorLiteralName: vi.fn(),
    recordError: vi.fn(),
  };
  const domainEventReader = {
    listAfterCursor: vi.fn().mockResolvedValue(rows),
    getById: vi.fn(),
    listLockedForProjector: vi.fn(),
  };
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  const deps = {
    invalidator: { invalidate: vi.fn().mockResolvedValue(undefined) },
    lotSaleId: vi.fn().mockResolvedValue(SALE),
    latestEventId: vi.fn().mockResolvedValue(900),
  };
  const ctx = { projectorStateRepo, domainEventReader, log } as never;
  return { ctx, deps, projectorStateRepo, domainEventReader, log };
}

describe("processWebPublicCache", () => {
  it("starts from the newest event on its first run instead of replaying history", async () => {
    const t = setup(0, []);
    await processWebPublicCache(t.ctx, t.deps);
    expect(t.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      WEB_PUBLIC_CACHE_PROJECTOR,
      900,
    );
    expect(t.domainEventReader.listAfterCursor).not.toHaveBeenCalled();
    expect(t.deps.invalidator.invalidate).not.toHaveBeenCalled();
  });

  it("drops the lot and sale tags of each committed event, then moves on", async () => {
    const t = setup(10, [
      { id: 11, eventType: "lot.ended", aggregateId: LOT, payload: { saleId: SALE } },
      { id: 12, eventType: "sale.rescheduled", aggregateId: SALE, payload: { saleId: SALE } },
    ]);
    await processWebPublicCache(t.ctx, t.deps);

    const tags = t.deps.invalidator.invalidate.mock.calls[0]?.[0] as string[];
    expect(tags).toEqual(
      expect.arrayContaining([`public-lot:${LOT}`, `public-sale:${SALE}`, "catalogue-lots"]),
    );
    expect(new Set(tags).size).toBe(tags.length);
    expect(t.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(WEB_PUBLIC_CACHE_PROJECTOR, 12);
  });

  it("looks up the sale of a withdrawn lot, whose event names none", async () => {
    const t = setup(10, [
      { id: 11, eventType: "lot.cancelled", aggregateId: LOT, payload: { reason: "withdrawal" } },
    ]);
    await processWebPublicCache(t.ctx, t.deps);
    expect(t.deps.lotSaleId).toHaveBeenCalledWith(LOT);
    expect(t.deps.invalidator.invalidate.mock.calls[0]?.[0]).toContain(`public-sale:${SALE}`);
  });

  it("keeps the cursor when the web app cannot be reached, so the batch is sent again", async () => {
    const t = setup(10, [
      { id: 11, eventType: "lot.published", aggregateId: LOT, payload: { saleId: SALE } },
    ]);
    t.deps.invalidator.invalidate.mockRejectedValue(new Error("down"));
    await processWebPublicCache(t.ctx, t.deps);
    expect(t.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
    expect(t.log.warn).toHaveBeenCalled();
  });

  it("asks only for the events public pages show", async () => {
    const t = setup(10, []);
    await processWebPublicCache(t.ctx, t.deps);
    const { eventTypes } = t.domainEventReader.listAfterCursor.mock.calls[0]?.[1] as {
      eventTypes: string[];
    };
    expect(eventTypes).toContain("lot.cancelled");
    expect(eventTypes).toContain("sale.rescheduled");
    expect(eventTypes).not.toContain("lot.seller_consent_given");
  });
});
