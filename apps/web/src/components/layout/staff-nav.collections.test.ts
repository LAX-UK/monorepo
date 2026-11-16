import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { getStaffNavGroups } from "./staff-nav";

const collections = (staffRole: UserStaffRole, collectionsToHandOver = 3) =>
  getStaffNavGroups("staff", 0, [staffRole], 0, {
    ...EMPTY_ADMIN_NAV_COUNTS,
    collectionsToHandOver,
  })
    .flatMap((group) => group.items)
    .find((item) => item.id === "collections");

describe("staff nav: Collections", () => {
  it.each(["fulfilment", "administrator", "read_only"] as const)(
    "shows %s the works waiting to be handed over",
    (role) => {
      expect(collections(role)).toMatchObject({ badge: 3, badgeTone: "warning" });
    },
  );

  it("offers Finance the page for its Storage tab, without a hand-over count it cannot act on", () => {
    const item = collections("finance");
    expect(item?.href).toBe("/admin/collections");
    expect(item?.badge).toBeUndefined();
    expect(item?.badgeTone).toBeUndefined();
  });

  it("shows no count when nothing is waiting", () => {
    expect(collections("fulfilment", 0)?.badge).toBeUndefined();
  });
});
