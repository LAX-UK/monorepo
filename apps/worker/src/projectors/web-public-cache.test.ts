import { WebRevalidateRejectedError } from "@auction/background-runtime";
import { describe, expect, it, vi } from "vitest";

const captureBackgroundError = vi.fn();
vi.mock("@auction/observability", () => ({
  captureBackgroundError: (...args: unknown[]) => captureBackgroundError(...args),
}));

const { WEB_PUBLIC_CACHE_PROJECTOR, processWebPublicCache } = await import("./web-public-cache.js");

const LOT = "0b8f0c1e-7c39-4a1c-9d1f-1f0f6a2b3c4d";
const SALE = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-11-14T12:00:00Z");

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
  captureBackgroundError.mockClear();
  const deps = {
    invalidator: { invalidate: vi.fn().mockResolvedValue(undefined) },
    lotSaleId: vi.fn().mockResolvedValue(SALE),
    latestEventId: vi.fn().mockResolvedValue(900),
    now: () => NOW,
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

  it("keeps the cursor on a 503 and a 429, so the batch is sent again", async () => {
    for (const status of [503, 429]) {
      const t = setup(10, [
        { id: 11, eventType: "lot.published", aggregateId: LOT, payload: { saleId: SALE } },
      ]);
      t.deps.invalidator.invalidate.mockRejectedValue(new WebRevalidateRejectedError(status));
      await processWebPublicCache(t.ctx, t.deps);
      expect(t.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
      expect(captureBackgroundError).not.toHaveBeenCalled();
    }
  });

  it("reports a transient failure once the batch has waited 15 minutes", async () => {
    const t = setup(10, [
      {
        id: 11,
        eventType: "lot.published",
        aggregateId: LOT,
        payload: { saleId: SALE },
        occurredAt: new Date(NOW - 16 * 60_000),
      },
    ]);
    t.deps.invalidator.invalidate.mockRejectedValue(new WebRevalidateRejectedError(503));
    await processWebPublicCache(t.ctx, t.deps);
    expect(t.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
    expect(captureBackgroundError).toHaveBeenCalledWith(
      "projector",
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ outcome: "cursor_lagging" }) }),
    );
  });

  it.each([400, 401, 404])(
    "moves past a batch the web app refuses for good (%i), and reports it",
    async (status) => {
      const t = setup(10, [
        { id: 11, eventType: "lot.published", aggregateId: LOT, payload: { saleId: SALE } },
        { id: 12, eventType: "lot.ended", aggregateId: LOT, payload: { saleId: SALE } },
      ]);
      t.deps.invalidator.invalidate.mockRejectedValue(new WebRevalidateRejectedError(status));
      await processWebPublicCache(t.ctx, t.deps);
      expect(t.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
        WEB_PUBLIC_CACHE_PROJECTOR,
        12,
      );
      expect(t.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ fromEventId: 11, toEventId: 12 }),
        "web_public_cache_batch_rejected",
      );
      expect(t.projectorStateRepo.recordError).toHaveBeenCalledWith(
        WEB_PUBLIC_CACHE_PROJECTOR,
        expect.stringContaining("11..12"),
      );
      expect(captureBackgroundError).toHaveBeenCalledWith(
        "projector",
        expect.anything(),
        expect.objectContaining({ tags: expect.objectContaining({ outcome: "batch_rejected" }) }),
      );
    },
  );

  it("drops a tag the web route would refuse before sending, and sends the rest", async () => {
    const t = setup(10, [
      {
        id: 11,
        eventType: "lot.attached_to_sale",
        aggregateId: LOT,
        payload: {
          saleId: SALE,
          fromSaleId: "not a valid id!",
        },
      },
    ]);
    await processWebPublicCache(t.ctx, t.deps);
    const sent = t.deps.invalidator.invalidate.mock.calls[0]?.[0] as string[];
    expect(sent).toContain(`public-sale:${SALE}`);
    expect(sent.some((tag) => tag.includes("not a valid id"))).toBe(false);
    expect(t.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      "web_public_cache_tags_dropped",
    );
    expect(t.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(WEB_PUBLIC_CACHE_PROJECTOR, 11);
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
