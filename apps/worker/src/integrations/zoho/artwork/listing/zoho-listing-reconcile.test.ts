import type { ZohoListingRun } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { RECONCILE_FAILURES_KEPT, ZohoListingReconcile } from "./zoho-listing-reconcile.js";
import { EMPTY_REPORT } from "./zoho-listing-sync.js";

const START = new Date("2026-11-05T03:00:00Z");
const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `id-${String(from + i).padStart(4, "0")}`);

function setup(pages: string[][], sync: (ids: readonly string[]) => Promise<typeof EMPTY_REPORT>) {
  const pageOriginals = vi.fn(async () => pages.shift() ?? []);
  const record = vi.fn(async (_run: ZohoListingRun) => undefined);
  const reconcile = new ZohoListingReconcile({
    mode: "live",
    sync: { sync: vi.fn(sync) },
    sources: { pageOriginals },
    runs: { record },
    log: { info: vi.fn(), warn: vi.fn() } as unknown as Logger,
    now: () => START,
  });
  return { reconcile, pageOriginals, record };
}

describe("ZohoListingReconcile", () => {
  it("walks every original page by page and records the pass", async () => {
    const { reconcile, pageOriginals, record } = setup(
      [ids(0, 200), ids(200, 3)],
      async (batch) => ({
        ...EMPTY_REPORT,
        failures: [],
        checked: batch.length,
        changed: 1,
        unchanged: batch.length - 1,
      }),
    );
    await reconcile.run();
    expect(pageOriginals).toHaveBeenNthCalledWith(1, null, 200);
    expect(pageOriginals).toHaveBeenNthCalledWith(2, "id-0199", 200);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "live",
        checked: 203,
        changed: 2,
        unchanged: 201,
        failed: 0,
        failures: [],
        startedAt: START,
      }),
    );
  });

  it("carries on past a page that fails, and keeps the first failures for staff", async () => {
    let call = 0;
    const { reconcile, record } = setup([ids(0, 200), ids(200, 5)], async (batch) => {
      call += 1;
      if (call === 1) {
        throw new CrmGatewayError({
          code: "TOO_MANY_REQUESTS",
          message: "slow",
          status: 429,
          retryable: true,
        });
      }
      return { ...EMPTY_REPORT, failures: [], checked: batch.length, unchanged: batch.length };
    });
    await reconcile.run();
    const run = record.mock.calls[0]?.[0];
    expect(run?.checked).toBe(205);
    expect(run?.failed).toBe(200);
    expect(run?.failures).toHaveLength(RECONCILE_FAILURES_KEPT);
    expect(run?.failures[0]).toEqual({
      registerId: "id-0000",
      stockCode: "",
      code: "TOO_MANY_REQUESTS",
    });
  });
});
