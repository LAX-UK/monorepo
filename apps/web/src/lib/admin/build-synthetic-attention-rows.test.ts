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

  it("includes telephone booking attention when pending count is non-zero", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      telephoneBookingsPending: 2,
    });
    expect(rows.some((r) => r.id === "nav-telephone-bookings")).toBe(true);
    expect(rows.some((r) => r.href === "/admin/saleroom")).toBe(true);
  });

  it("includes compliance queue deep links when counts are non-zero", () => {
    const rows = buildSyntheticAttentionRows({
      ...EMPTY_ADMIN_NAV_COUNTS,
      amlScreeningsPending: 1,
      sourceOfFundsPending: 2,
    });
    expect(rows.some((r) => r.href === "/admin/compliance/aml")).toBe(true);
    expect(rows.some((r) => r.href === "/admin/compliance/source-of-funds")).toBe(true);
  });
});
