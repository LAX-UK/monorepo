import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { LISTING_PAGE_SIZE } from "../listing/sync-pages.js";
import { ZohoStatusReconcile } from "./zoho-status-reconcile.js";
import type { StatusOutcome } from "./zoho-status-sync.js";

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `id-${String(from + i).padStart(4, "0")}`);

const who = (registerId: string) => ({
  registerId,
  stockCode: `S-${registerId}`,
  zohoProductId: "p",
});

function setup(pages: string[][], sync: (ids: readonly string[]) => Promise<StatusOutcome[]>) {
  const pageOriginals = vi.fn(async () => pages.shift() ?? []);
  const log = { info: vi.fn(), warn: vi.fn() };
  const reconcile = new ZohoStatusReconcile({
    sync: { sync: vi.fn(sync) },
    sources: { pageOriginals },
    log: log as unknown as Logger,
  });
  return { reconcile, pageOriginals, log };
}

describe("ZohoStatusReconcile", () => {
  it("walks every original page by page and counts what the compare decided", async () => {
    const { reconcile, pageOriginals, log } = setup(
      [ids(0, LISTING_PAGE_SIZE), ids(LISTING_PAGE_SIZE, 3)],
      async (batch) =>
        batch.map((id, index): StatusOutcome => {
          if (index === 0) return { ...who(id), kind: "written", status: "Available" };
          if (index === 1)
            return { ...who(id), kind: "conflict", zohoStatus: "Sold", wanted: "Withdrawn" };
          return { ...who(id), kind: "in_sync" };
        }),
    );
    const report = await reconcile.run();
    expect(pageOriginals).toHaveBeenNthCalledWith(1, null, LISTING_PAGE_SIZE);
    expect(pageOriginals).toHaveBeenNthCalledWith(2, "id-0199", LISTING_PAGE_SIZE);
    expect(report).toMatchObject({
      checked: LISTING_PAGE_SIZE + 3,
      written: 2,
      conflicts: 2,
      unchanged: LISTING_PAGE_SIZE + 3 - 4,
      stale: 0,
    });
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        checked: LISTING_PAGE_SIZE + 3,
        written: 2,
        conflicts: 2,
        failed: 0,
      }),
      "zoho_status_reconcile_finished",
    );
  });

  it("repairs only where compare-and-set allows: a conflict counts and nothing else happens here", async () => {
    const sync = vi.fn(async (batch: readonly string[]) =>
      batch.map(
        (id): StatusOutcome => ({
          ...who(id),
          kind: "conflict",
          zohoStatus: "Reserved",
          wanted: "Withdrawn",
        }),
      ),
    );
    const { reconcile } = setup([["a"]], sync);
    expect((await reconcile.run()).conflicts).toBe(1);
  });

  it("carries on past a page that fails, and counts every record on it as failed", async () => {
    let call = 0;
    const { reconcile, log } = setup(
      [ids(0, LISTING_PAGE_SIZE), ids(LISTING_PAGE_SIZE, 5)],
      async (batch) => {
        call += 1;
        if (call === 1) {
          throw new CrmGatewayError({
            code: "TOO_MANY_REQUESTS",
            message: "slow",
            status: 429,
            retryable: true,
          });
        }
        return batch.map((id): StatusOutcome => ({ ...who(id), kind: "in_sync" }));
      },
    );
    const report = await reconcile.run();
    expect(report.failures).toHaveLength(LISTING_PAGE_SIZE);
    expect(report.failures[0]).toMatchObject({ code: "TOO_MANY_REQUESTS", retryable: true });
    expect(report.unchanged).toBe(5);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
      "zoho_status_reconcile_page_failed",
    );
  });

  it("reports an empty register as an empty pass", async () => {
    const { reconcile } = setup([], async () => []);
    expect(await reconcile.run()).toMatchObject({ checked: 0, written: 0, conflicts: 0 });
  });
});
