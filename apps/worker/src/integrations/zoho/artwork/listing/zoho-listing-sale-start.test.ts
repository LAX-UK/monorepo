import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import {
  SALE_START_PASS_LOOKBACK_MS,
  SALE_START_PASS_MAX_LOOKBACK_MS,
  SALE_START_PASS_MAX_PAGES,
  ZohoListingSaleStartPass,
  saleStartWindow,
} from "./zoho-listing-sale-start.js";
import { EMPTY_REPORT, type ListingSyncReport } from "./zoho-listing-sync.js";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `id-${String(from + i).padStart(4, "0")}`);

function fakeMark(initial: Date | null) {
  let at = initial;
  return {
    lastCoveredTo: vi.fn(async () => at),
    markCoveredTo: vi.fn(async (to: Date) => {
      at = to;
    }),
    current: () => at,
  };
}

const minutesBefore = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60_000);

function setup(
  pages: string[][],
  sync: (ids: readonly string[]) => Promise<ListingSyncReport> = async (batch) => ({
    ...EMPTY_REPORT,
    checked: batch.length,
    changed: batch.length,
  }),
  lastCoveredTo: Date | null = null,
) {
  const registerIdsForSalesStartedBetween = vi.fn(async () => pages.shift() ?? []);
  const syncFn = vi.fn(sync);
  const mark = fakeMark(lastCoveredTo);
  const log = { info: vi.fn(), warn: vi.fn() };
  const pass = new ZohoListingSaleStartPass({
    sync: { sync: syncFn },
    sources: { registerIdsForSalesStartedBetween },
    mark,
    log: log as unknown as Logger,
    now: () => NOW,
  });
  return { pass, registerIdsForSalesStartedBetween, syncFn, mark, log };
}

describe("saleStartWindow", () => {
  it("on the first run (no mark) ends at now and reaches back one interval plus slack", () => {
    const { from, to } = saleStartWindow(NOW, null);
    expect(to).toEqual(NOW);
    expect(NOW.getTime() - from.getTime()).toBe(SALE_START_PASS_LOOKBACK_MS);
    expect(SALE_START_PASS_LOOKBACK_MS).toBe(20 * 60_000);
  });

  it("keeps the usual overlap when the last run was on time", () => {
    const { from } = saleStartWindow(NOW, minutesBefore(NOW, 15));
    expect(from).toEqual(minutesBefore(NOW, 20));
  });

  it("starts from the mark when the run was delayed by more than the slack", () => {
    const last = minutesBefore(NOW, 45);
    expect(saleStartWindow(NOW, last).from).toEqual(last);
  });

  it("never reaches back further than the nightly interval", () => {
    const { from } = saleStartWindow(NOW, minutesBefore(NOW, 3 * 24 * 60));
    expect(NOW.getTime() - from.getTime()).toBe(SALE_START_PASS_MAX_LOOKBACK_MS);
  });

  it("is exclusive at its start and inclusive at its end (matching the reader's query)", () => {
    const { from, to } = saleStartWindow(NOW, null);
    const inWindow = (start: Date) => start > from && start <= to;
    expect(inWindow(from)).toBe(false);
    expect(inWindow(new Date(from.getTime() + 1))).toBe(true);
    expect(inWindow(to)).toBe(true);
    expect(inWindow(new Date(to.getTime() + 1))).toBe(false);
  });

  it("leaves no gap between consecutive windows", () => {
    const first = saleStartWindow(NOW, null);
    const later = new Date(NOW.getTime() + 40 * 60_000);
    expect(saleStartWindow(later, first.to).from.getTime()).toBeLessThanOrEqual(first.to.getTime());
  });
});

describe("ZohoListingSaleStartPass", () => {
  it("syncs the lots of sales that started in the window", async () => {
    const { pass, registerIdsForSalesStartedBetween, syncFn } = setup([["a", "b"]]);
    const report = await pass.run();
    expect(registerIdsForSalesStartedBetween).toHaveBeenCalledWith(
      saleStartWindow(NOW, null),
      null,
      200,
    );
    expect(syncFn).toHaveBeenCalledWith(["a", "b"]);
    expect(report.changed).toBe(2);
  });

  it("does nothing when no sale started", async () => {
    const { pass, syncFn } = setup([[]]);
    expect((await pass.run()).checked).toBe(0);
    expect(syncFn).not.toHaveBeenCalled();
  });

  it("pages with a cursor until a short page", async () => {
    const { pass, registerIdsForSalesStartedBetween, syncFn } = setup([ids(0, 200), ids(200, 3)]);
    expect((await pass.run()).checked).toBe(203);
    expect(registerIdsForSalesStartedBetween).toHaveBeenNthCalledWith(
      2,
      saleStartWindow(NOW, null),
      "id-0199",
      200,
    );
    expect(syncFn).toHaveBeenCalledTimes(2);
  });

  it("stops at the page bound", async () => {
    const { pass, registerIdsForSalesStartedBetween } = setup(
      Array.from({ length: SALE_START_PASS_MAX_PAGES + 5 }, (_, i) => ids(i * 200, 200)),
    );
    await pass.run();
    expect(registerIdsForSalesStartedBetween).toHaveBeenCalledTimes(SALE_START_PASS_MAX_PAGES);
  });

  it("carries on past a failed page, then fails the run", async () => {
    let calls = 0;
    const { pass, syncFn } = setup([ids(0, 200), ids(200, 1)], async (batch) => {
      calls += 1;
      if (calls === 1) {
        throw new CrmGatewayError({ code: "boom", message: "x", status: 503, retryable: true });
      }
      return { ...EMPTY_REPORT, checked: batch.length };
    });
    await expect(pass.run()).rejects.toThrow("zoho_listing_sale_start_failed:200");
    expect(syncFn).toHaveBeenCalledTimes(2);
  });

  it("fails the run when the sync reports failures", async () => {
    const { pass } = setup([["a"]], async () => ({
      ...EMPTY_REPORT,
      checked: 1,
      failures: [{ registerId: "a", code: "x", retryable: false }],
    }));
    await expect(pass.run()).rejects.toThrow("zoho_listing_sale_start_failed:1");
  });

  it("warns when the page cap is hit and still moves the mark", async () => {
    const { pass, log, mark } = setup(
      Array.from({ length: SALE_START_PASS_MAX_PAGES + 1 }, (_, i) => ids(i * 200, 200)),
    );
    await pass.run();
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ maxPages: SALE_START_PASS_MAX_PAGES }),
      "zoho_listing_sale_start_page_cap_reached",
    );
    expect(mark.markCoveredTo).toHaveBeenCalledWith(NOW);
  });

  it("does not warn when the last allowed page is short", async () => {
    const { pass, log } = setup([ids(0, 3)]);
    await pass.run();
    expect(log.warn).not.toHaveBeenCalled();
  });

  describe("the high-water mark", () => {
    it("moves to the end of the window after a clean run", async () => {
      const { pass, mark } = setup([["a"]]);
      await pass.run();
      expect(mark.markCoveredTo).toHaveBeenCalledWith(NOW);
    });

    it("moves even when nothing started", async () => {
      const { pass, mark } = setup([[]]);
      await pass.run();
      expect(mark.current()).toEqual(NOW);
    });

    it("on the first run with no mark, looks back the usual window", async () => {
      const { pass, registerIdsForSalesStartedBetween } = setup([[]], undefined, null);
      await pass.run();
      expect(registerIdsForSalesStartedBetween).toHaveBeenCalledWith(
        { from: minutesBefore(NOW, 20), to: NOW },
        null,
        200,
      );
    });

    it("a run delayed by more than 5 minutes still sees the sales in the gap", async () => {
      const last = minutesBefore(NOW, 50);
      const { pass, registerIdsForSalesStartedBetween } = setup([[]], undefined, last);
      await pass.run();
      expect(registerIdsForSalesStartedBetween).toHaveBeenCalledWith(
        { from: last, to: NOW },
        null,
        200,
      );
    });

    it("stays put after a failed run, so the next run covers the same ground", async () => {
      const last = minutesBefore(NOW, 15);
      const { pass, mark } = setup(
        [["a"]],
        async () => {
          throw new CrmGatewayError({ code: "boom", message: "x", status: 503, retryable: true });
        },
        last,
      );
      await expect(pass.run()).rejects.toThrow("zoho_listing_sale_start_failed:1");
      expect(mark.markCoveredTo).not.toHaveBeenCalled();
      expect(mark.current()).toEqual(last);

      // The retry, 15 minutes later: the window still reaches back to the failed run's start.
      const later = new Date(NOW.getTime() + 15 * 60_000);
      const registerIds = vi.fn(async () => [] as string[]);
      const retry = new ZohoListingSaleStartPass({
        sync: { sync: vi.fn(async () => EMPTY_REPORT) },
        sources: { registerIdsForSalesStartedBetween: registerIds },
        mark,
        log: { info: vi.fn(), warn: vi.fn() } as unknown as Logger,
        now: () => later,
      });
      await retry.run();
      expect(registerIds).toHaveBeenCalledWith({ from: last, to: later }, null, 200);
    });
  });
});
