import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

function privateSales(counts = {}) {
  const groups = getStaffNavGroups("staff", 0, ["sales_manager"], 0, {
    ...EMPTY_ADMIN_NAV_COUNTS,
    ...counts,
  });
  return groups.flatMap((group) => group.items).find((entry) => entry.label === "Private sales");
}

describe("staff nav: Private sales count", () => {
  it("shows no count when every settled deal's artwork is recorded sold", () => {
    expect(privateSales()?.badge).toBeUndefined();
  });

  it("counts the settled deals whose artwork was not marked sold", () => {
    expect(privateSales({ privateSalesAttention: 2 })).toMatchObject({
      badge: 2,
      badgeTone: "warning",
    });
  });

  it("turns the count red when one may have been sold twice", () => {
    expect(privateSales({ privateSalesAttention: 2, privateSalesUrgent: 1 })).toMatchObject({
      badge: 2,
      badgeTone: "danger",
    });
  });
});
