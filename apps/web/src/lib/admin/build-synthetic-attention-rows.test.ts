import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { buildSyntheticAttentionRows } from "./build-synthetic-attention-rows";

describe("buildSyntheticAttentionRows", () => {
  it("returns empty when all nav counts are zero", () => {
    expect(buildSyntheticAttentionRows(EMPTY_ADMIN_NAV_COUNTS)).toEqual([]);
  });

  it("includes fulfilment and condition report deep links", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      lotFulfilmentPending: 2,
      conditionReportsPending: 1,
    });
    expect(rows.some((r) => r.href === "/admin/lot-fulfilment")).toBe(true);
    expect(rows.some((r) => r.href === "/admin/condition-reports")).toBe(true);
  });
});
