import { describe, expect, it, vi } from "vitest";
import { EMPTY_REPORT } from "../listing/zoho-listing-sync.js";
import { ZohoLocationReconcile } from "./zoho-location-reconcile.js";

describe("ZohoLocationReconcile", () => {
  it("walks every original through the sync and logs the totals", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${String(i).padStart(3, "0")}`);
    const pageOriginals = vi.fn(async (after: string | null, limit: number) => {
      const start = after ? ids.indexOf(after) + 1 : 0;
      return ids.slice(start, start + limit);
    });
    const sync = {
      sync: vi.fn(async (batch: readonly string[]) => ({
        ...EMPTY_REPORT,
        checked: batch.length,
        changed: 1,
        unchanged: batch.length - 1,
        failures: [],
      })),
    };
    const log = { info: vi.fn(), warn: vi.fn() };
    const report = await new ZohoLocationReconcile({
      mode: "live",
      sync,
      sources: { pageOriginals },
      log: log as never,
    }).run();
    expect(sync.sync).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({ checked: 250, changed: 2, unchanged: 248 });
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "live", checked: 250, changed: 2, failed: 0 }),
      "zoho_location_reconcile_finished",
    );
  });

  it("counts a failed page and carries on", async () => {
    const pages = [["a"], []];
    const sync = { sync: vi.fn(async () => Promise.reject(new Error("boom"))) };
    const log = { info: vi.fn(), warn: vi.fn() };
    const report = await new ZohoLocationReconcile({
      mode: "dry_run",
      sync,
      sources: { pageOriginals: vi.fn(async () => pages.shift() ?? []) },
      log: log as never,
    }).run();
    expect(report.failures).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledWith(expect.anything(), "zoho_location_reconcile_page_failed");
  });
});
