import type { IAtgLinkReader } from "@auction/persistence/interfaces";
import type { AtgSyncQueueProducer } from "@auction/queues";
import type { AtgSaleSyncView } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AtgAdminService } from "./atg-admin.service.js";

const SALE_ID = "11111111-1111-4111-8111-111111111111";
const LOT_ID = "22222222-2222-4222-8222-222222222222";

function view(overrides: Partial<AtgSaleSyncView> = {}): AtgSaleSyncView {
  return {
    saleId: SALE_ID,
    saleStatus: "draft",
    sellingPlatform: "free",
    saleCancelled: false,
    linked: false,
    atgAuctionId: null,
    remoteStatus: null,
    publishedAt: null,
    closedAt: null,
    lastSyncedAt: null,
    lastPolledAt: null,
    lastError: null,
    results: [],
    lots: [],
    ...overrides,
  };
}

function setup(opts: {
  enabled?: boolean;
  sale?: AtgSaleSyncView | null;
  atgLotId?: string | null;
  queueDown?: boolean;
}) {
  const reader: IAtgLinkReader = {
    getSaleView: vi.fn().mockResolvedValue(opts.sale === undefined ? view() : opts.sale),
    findAtgLotId: vi.fn().mockResolvedValue(opts.atgLotId ?? null),
    getSaleOwnership: vi.fn(),
    getSaleOwnerships: vi.fn(),
    getLotAtgState: vi.fn(),
    getSoldLotIds: vi.fn(),
  };
  const queue: AtgSyncQueueProducer = {
    add: opts.queueDown
      ? vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
      : vi.fn().mockResolvedValue({}),
    getJobState: vi.fn().mockResolvedValue("active"),
    close: vi.fn(),
  };
  const service = new AtgAdminService(
    reader,
    opts.enabled === false ? null : queue,
    "https://wl.example",
  );
  return { service, queue };
}

describe("AtgAdminService", () => {
  it("reports status from the flag", () => {
    expect(setup({}).service.status()).toEqual({
      enabled: true,
      whiteLabelBaseUrl: "https://wl.example",
    });
    expect(setup({ enabled: false }).service.status().enabled).toBe(false);
  });

  it("enqueues a deduplicated push job", async () => {
    const { service, queue } = setup({});

    const result = await service.enqueueSaleAction(SALE_ID, "push");

    expect(result).toEqual({ ok: true, jobId: `atg.push-sale__${SALE_ID}` });
    expect(queue.add).toHaveBeenCalledWith(
      "atg.push-sale",
      { saleId: SALE_ID },
      { jobId: `atg.push-sale__${SALE_ID}`, removeOnComplete: true, removeOnFail: true },
    );
  });

  it("returns 503 without touching the queue when disabled", async () => {
    const { service, queue } = setup({ enabled: false });
    const result = await service.enqueueSaleAction(SALE_ID, "push");
    expect(result).toMatchObject({ ok: false, error: { status: 503, code: "atg_disabled" } });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown sales and 409 when closing an unlinked sale", async () => {
    expect(await setup({ sale: null }).service.enqueueSaleAction(SALE_ID, "publish")).toMatchObject(
      { ok: false, error: { status: 404 } },
    );
    expect(await setup({}).service.enqueueSaleAction(SALE_ID, "close")).toMatchObject({
      ok: false,
      error: { status: 409, code: "not_linked" },
    });
    expect(
      await setup({ sale: view({ linked: true, atgAuctionId: "a" }) }).service.enqueueSaleAction(
        SALE_ID,
        "close",
      ),
    ).toMatchObject({ ok: true });
  });

  it("refuses to push or publish cancelled sales but still lets a linked one be closed", async () => {
    const cancelled = view({ saleCancelled: true, linked: true, atgAuctionId: "a" });
    for (const action of ["push", "publish"] as const) {
      expect(
        await setup({ sale: cancelled }).service.enqueueSaleAction(SALE_ID, action),
      ).toMatchObject({ ok: false, error: { status: 409, code: "sale_cancelled" } });
    }
    expect(
      await setup({ sale: cancelled }).service.enqueueSaleAction(SALE_ID, "close"),
    ).toMatchObject({
      ok: true,
    });
  });

  it("refuses every action once the ATG auction is closed", async () => {
    const closed = view({ linked: true, atgAuctionId: "a", remoteStatus: "closed" });
    for (const action of ["push", "publish", "close"] as const) {
      const { service, queue } = setup({ sale: closed });
      expect(await service.enqueueSaleAction(SALE_ID, action)).toMatchObject({
        ok: false,
        error: { status: 409, code: "atg_closed" },
      });
      expect(queue.add).not.toHaveBeenCalled();
    }
  });

  it("refuses to push or publish a sale that is selling on lax.bid, but still allows close", async () => {
    const onLax = view({
      saleStatus: "scheduled",
      sellingPlatform: "lax",
      linked: true,
      atgAuctionId: "a",
    });
    for (const action of ["push", "publish"] as const) {
      const { service, queue } = setup({ sale: onLax });
      expect(await service.enqueueSaleAction(SALE_ID, action)).toMatchObject({
        ok: false,
        error: { status: 409, code: "sale_on_lax" },
      });
      expect(queue.add).not.toHaveBeenCalled();
    }
    expect(await setup({ sale: onLax }).service.enqueueSaleAction(SALE_ID, "close")).toMatchObject({
      ok: true,
    });
  });

  it("returns 503 queue_unavailable when Redis rejects the job", async () => {
    expect(await setup({ queueDown: true }).service.enqueueSaleAction(SALE_ID, "push")).toEqual({
      ok: false,
      error: {
        status: 503,
        code: "queue_unavailable",
        message: "ATG queue is unavailable. Try again shortly.",
      },
    });
  });

  it("reports job state from the queue, or null when ATG is disabled", async () => {
    const { service, queue } = setup({});
    expect(await service.getJobState("job-1")).toBe("active");
    expect(queue.getJobState).toHaveBeenCalledWith("job-1");
    expect(await setup({ enabled: false }).service.getJobState("job-1")).toBeNull();
  });

  it("deletes only lots that exist on ATG", async () => {
    expect(await setup({}).service.enqueueLotDelete(LOT_ID)).toMatchObject({
      ok: false,
      error: { status: 404, code: "lot_not_linked" },
    });
    const { service, queue } = setup({ atgLotId: "atg-l1" });
    expect(await service.enqueueLotDelete(LOT_ID)).toEqual({
      ok: true,
      jobId: `atg.delete-lot__${LOT_ID}`,
    });
    expect(queue.add).toHaveBeenCalledWith("atg.delete-lot", { lotId: LOT_ID }, expect.anything());
  });
});
