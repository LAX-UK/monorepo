import {
  ARTWORK_WRITEBACK_SKIP,
  ORDER_MIRROR_SKIP,
  listDomainEventTypesForConsumer,
} from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  DRY_RUN_SKIP_REASON,
  ZOHO_CATCH_UP_CONSUMERS,
  type ZohoCatchUpConsumer,
  catchUpAfterGoingLive,
} from "./zoho-go-live-catch-up.js";

/** A ledger holding `skipped` dry-run deliveries; replay takes them off the top, as SQL does. */
function ledger(skipped: number) {
  let left = skipped;
  return {
    countSkippedForEventTypes: vi.fn(async () => left),
    replaySkippedForEventTypes: vi.fn(async ({ limit }: { limit: number }) => {
      const taken = Math.min(limit, left);
      left -= taken;
      return taken;
    }),
    left: () => left,
  };
}

const CONSUMERS = Object.keys(ZOHO_CATCH_UP_CONSUMERS) as ZohoCatchUpConsumer[];

describe("catchUpAfterGoingLive", () => {
  it("covers the artwork writeback, the listing and the fulfilment mirror", () => {
    expect(ZOHO_CATCH_UP_CONSUMERS).toEqual({
      zoho_artwork_writeback: "ZOHO_ARTWORK_WRITEBACK_MODE",
      zoho_artwork_listing: "ZOHO_ARTWORK_LISTING_MODE",
      zoho_fulfilment: "ZOHO_FULFILMENT_MIRROR_MODE",
    });
  });

  it("looks for the reason every write-back leaves in a dry run", () => {
    expect(DRY_RUN_SKIP_REASON).toBe("dry_run");
    expect(ORDER_MIRROR_SKIP.dryRun).toBe(DRY_RUN_SKIP_REASON);
    expect(ARTWORK_WRITEBACK_SKIP.dryRun).toBe(DRY_RUN_SKIP_REASON);
  });

  it.each(CONSUMERS)("puts back only %s's dry-run skips, for its own events", async (consumer) => {
    const repo = ledger(3);
    await catchUpAfterGoingLive({ consumer, mode: "live", apply: true, repo });
    const filter = {
      consumer,
      eventTypes: listDomainEventTypesForConsumer(consumer),
      reason: "dry_run",
    };
    expect(filter.eventTypes.length).toBeGreaterThan(0);
    expect(repo.countSkippedForEventTypes).toHaveBeenCalledWith(filter);
    expect(repo.replaySkippedForEventTypes).toHaveBeenCalledWith({ ...filter, limit: 3 });
  });

  it("puts every dry-run skip back in pages and says how many", async () => {
    const repo = ledger(1_201);
    const summary = await catchUpAfterGoingLive({
      consumer: "zoho_fulfilment",
      mode: "live",
      apply: true,
      repo,
      pageSize: 500,
    });
    expect(summary).toEqual({
      consumer: "zoho_fulfilment",
      mode: "live",
      apply: true,
      dryRunSkipped: 1_201,
      requeued: 1_201,
      remaining: 0,
    });
    expect(repo.replaySkippedForEventTypes.mock.calls.map(([c]) => c.limit)).toEqual([
      500, 500, 201,
    ]);
    expect(repo.left()).toBe(0);
  });

  it("a preview counts and changes nothing, in any mode", async () => {
    for (const mode of ["off", "dry_run", "live"] as const) {
      const repo = ledger(7);
      const summary = await catchUpAfterGoingLive({
        consumer: "zoho_artwork_writeback",
        mode,
        apply: false,
        repo,
      });
      expect(summary).toMatchObject({
        mode,
        apply: false,
        dryRunSkipped: 7,
        requeued: 0,
        remaining: 7,
      });
      expect(repo.replaySkippedForEventTypes).not.toHaveBeenCalled();
    }
  });

  it.each(["off", "dry_run"] as const)("refuses to put anything back while %s", async (mode) => {
    const repo = ledger(4);
    await expect(
      catchUpAfterGoingLive({ consumer: "zoho_artwork_listing", mode, apply: true, repo }),
    ).rejects.toThrow(/ZOHO_ARTWORK_LISTING_MODE to live/);
    expect(repo.countSkippedForEventTypes).not.toHaveBeenCalled();
    expect(repo.replaySkippedForEventTypes).not.toHaveBeenCalled();
  });

  it("stops at the limit and reports the rest as remaining", async () => {
    const repo = ledger(900);
    const summary = await catchUpAfterGoingLive({
      consumer: "zoho_artwork_writeback",
      mode: "live",
      apply: true,
      limit: 600,
      repo,
      pageSize: 500,
    });
    expect(summary).toMatchObject({ dryRunSkipped: 900, requeued: 600, remaining: 300 });
    expect(repo.replaySkippedForEventTypes.mock.calls.map(([c]) => c.limit)).toEqual([500, 100]);
  });

  it("never puts back more than it counted, and is a no-op when run again", async () => {
    const repo = ledger(2);
    // A delivery skipped while the run goes on is not chased.
    repo.replaySkippedForEventTypes.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    const first = await catchUpAfterGoingLive({
      consumer: "zoho_fulfilment",
      mode: "live",
      apply: true,
      repo,
    });
    expect(first.requeued).toBe(2);
    expect(repo.replaySkippedForEventTypes).toHaveBeenCalledTimes(1);

    const empty = ledger(0);
    const again = await catchUpAfterGoingLive({
      consumer: "zoho_fulfilment",
      mode: "live",
      apply: true,
      repo: empty,
    });
    expect(again).toMatchObject({ dryRunSkipped: 0, requeued: 0, remaining: 0 });
    expect(empty.replaySkippedForEventTypes).not.toHaveBeenCalled();
  });
});
