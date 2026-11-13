import { describe, expect, it, vi } from "vitest";
import { FIXTURE_OLD_RULE_ROWS } from "./seller-proceeds.fixture";

const getOldRulePage = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-seller-proceeds.server", () => ({
  getOldRulePage,
  getHeldSales: vi.fn(),
  getPayoutSales: vi.fn(),
}));
vi.mock("@/lib/data/http/session.server", () => ({ getServerSessionUser: vi.fn() }));

const { exportOldRuleCsv } = await import("./load-payouts-special-views");

const row = FIXTURE_OLD_RULE_ROWS[0] as (typeof FIXTURE_OLD_RULE_ROWS)[number];

describe("exportOldRuleCsv", () => {
  it("exports every sale paid under the old rule, not just the page on screen", async () => {
    const total = 450;
    getOldRulePage.mockImplementation(async ({ limit, offset }) => ({
      data: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({
        ...row,
        lineId: `line-${offset + i}`,
      })),
      meta: { total, limit, offset },
    }));
    const rows = await exportOldRuleCsv();
    expect(rows).toHaveLength(total);
    expect(getOldRulePage.mock.calls.map((c) => c[0])).toEqual([
      { limit: 200, offset: 0 },
      { limit: 200, offset: 200 },
      { limit: 200, offset: 400 },
    ]);
  });
});
