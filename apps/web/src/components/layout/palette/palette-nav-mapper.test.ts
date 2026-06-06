import { FINANCE_ACCESS, STAFF_OVERVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { Gauge, WalletCards } from "lucide-react";
import { describe, expect, it } from "vitest";
import { mapStaffNavGroupsToPaletteSections } from "./palette-nav-mapper";

describe("mapStaffNavGroupsToPaletteSections", () => {
  it("maps icons, badges, and group hints from staff nav", () => {
    const sections = mapStaffNavGroupsToPaletteSections([
      {
        id: "overview",
        title: "Overview",
        icon: Gauge,
        items: [
          {
            id: "home",
            href: "/admin",
            label: "Dashboard",
            icon: Gauge,
            requirement: STAFF_OVERVIEW_ACCESS,
          },
        ],
      },
      {
        id: "finance",
        title: "Finance",
        icon: WalletCards,
        items: [
          {
            id: "payments",
            href: "/admin/payments",
            label: "Payments",
            icon: WalletCards,
            badge: 2,
            badgeTone: "danger",
            requirement: FINANCE_ACCESS,
          },
        ],
      },
    ]);

    expect(sections[1]?.items[0]).toMatchObject({
      id: "sn-payments",
      kind: "page",
      hint: "Finance",
      badge: 2,
      badgeTone: "danger",
    });
  });
});
