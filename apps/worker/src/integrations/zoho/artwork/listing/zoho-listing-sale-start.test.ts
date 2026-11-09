import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import {
  SALE_START_PASS_LOOKBACK_MS,
  SALE_START_PASS_MAX_PAGES,
  ZohoListingSaleStartPass,
  saleStartWindow,
} from "./zoho-listing-sale-start.js";
import { EMPTY_REPORT, type ListingSyncReport } from "./zoho-listing-sync.js";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `id-${String(from + i).padStart(4, "0")}`);

function setup(
  pages: string[][],
  sync: (ids: readonly string[]) => Promise<ListingSyncReport> = async (batch) => ({
    ...EMPTY_REPORT,
    checked: batch.length,
    changed: batch.length,
  }),
) {
  const registerIdsForSalesStartedBetween = vi.fn(async () => pages.shift() ?? []);
  const syncFn = vi.fn(sync);
  const pass = new ZohoListingSaleStartPass({
    sync: { sync: syncFn },
    sources: { registerIdsForSalesStartedBetween },
    log: { info: vi.fn(), warn: vi.fn() } as unknown as Logger,
    now: () => NOW,
  });
  return { pass, registerIdsForSalesStartedBetween, syncFn };
}

describe("saleStartWindow", () => {
  it("ends at now and reaches back one interval plus slack", () => {
    const { from, to } = saleStartWindow(NOW);
    expect(to).toEqual(NOW);
    expect(NOW.getTime() - from.getTime()).toBe(SALE_START_PASS_LOOKBACK_MS);
    expect(SALE_START_PASS_LOOKBACK_MS).toBe(20 * 60_000);
  });

  it("covers consecutive 15 minute runs with no gap", () => {
    const next = new Date(NOW.getTime() + 15 * 60_000);
    expect(saleStartWindow(next).from.getTime()).toBeLessThan(saleStartWindow(NOW).to.getTime());
  });

  it("is exclusive at its start and inclusive at its end (matching the reader's query)", () => {
    const { from, to } = saleStartWindow(NOW);
    const inWindow = (start: Date) => start > from && start <= to;
    expect(inWindow(from)).toBe(false);
    expect(inWindow(new Date(from.getTime() + 1))).toBe(true);
    expect(inWindow(to)).toBe(true);
    expect(inWindow(new Date(to.getTime() + 1))).toBe(false);
  });
});

describe("ZohoListingSaleStartPass", () => {
  it("syncs the lots of sales that started in the window", async () => {
    const { pass, registerIdsForSalesStartedBetween, syncFn } = setup([["a", "b"]]);
    const report = await pass.run();
    expect(registerIdsForSalesStartedBetween).toHaveBeenCalledWith(saleStartWindow(NOW), null, 200);
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
      saleStartWindow(NOW),
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
      failures: [{ registerId: "a", stockCode: "S1", code: "x", retryable: false }],
    }));
    await expect(pass.run()).rejects.toThrow("zoho_listing_sale_start_failed:1");
  });
});
