import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { WalletCards } from "lucide-react";
import { describe, expect, it } from "vitest";
import { buildSuggestedSection } from "./palette-suggested";
import type { PaletteSection } from "./types";

const navSections: PaletteSection[] = [
  {
    id: "overview",
    heading: "Overview",
    items: [{ id: "sn-home", href: "/admin", label: "Dashboard", badge: 0 }],
  },
  {
    id: "finance",
    heading: "Finance",
    items: [
      {
        id: "sn-payments",
        href: "/admin/payments",
        label: "Payments",
        badge: 2,
        badgeTone: "danger",
      },
      { id: "sn-payouts", href: "/admin/payouts", label: "Payouts" },
      { id: "sn-disputes", href: "/admin/disputes", label: "Disputes" },
    ],
  },
];

describe("buildSuggestedSection", () => {
  it("builds finance suggestions from nav sections", () => {
    const section = buildSuggestedSection({
      shellRole: "finance",
      navSections,
      navCounts: { ...EMPTY_ADMIN_NAV_COUNTS, manualReviewCount: 3 },
      pendingSubmissionCount: 0,
    });

    expect(section?.heading).toBe("Suggested");
    expect(section?.items.map((item) => item.href)).toEqual(
      expect.arrayContaining([
        "/admin/finance",
        "/admin/payments",
        "/admin/payouts",
        "/admin/disputes",
      ]),
    );
    expect(section?.items.find((item) => item.href === "/admin/finance")?.icon).toBe(WalletCards);
  });

  it("caps platform suggestions and prioritizes badge queues", () => {
    const section = buildSuggestedSection({
      shellRole: "platform",
      navSections: [
        ...navSections,
        {
          id: "catalog",
          heading: "Catalog",
          items: [
            {
              id: "sn-submissions",
              href: "/admin/submissions",
              label: "Submissions",
              badge: 4,
            },
          ],
        },
      ],
      navCounts: EMPTY_ADMIN_NAV_COUNTS,
      pendingSubmissionCount: 4,
    });

    expect(section?.items.length).toBeLessThanOrEqual(6);
    expect(section?.items.some((item) => item.href === "/admin/submissions")).toBe(true);
    expect(section?.items.some((item) => item.href === "/admin/payments")).toBe(true);
  });
});
