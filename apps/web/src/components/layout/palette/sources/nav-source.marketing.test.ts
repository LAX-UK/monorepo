import { buildNavPaletteSections } from "@/components/layout/palette/sources/nav-source";
import { NO_NAV_ACTIVITY } from "@/lib/marketing/nav-activity";
import { describe, expect, it } from "vitest";

function labels(activity = NO_NAV_ACTIVITY, signedIn = false): string[] {
  const user = signedIn ? ({ role: "client", staffRoles: [] } as never) : null;
  return buildNavPaletteSections("marketing", "", user, 0, 0, true, undefined, activity).flatMap(
    (section) => section.items.map((item) => item.label),
  );
}

describe("marketing palette pages", () => {
  it("lists only the pages that always have content when nothing is live", () => {
    const all = labels();
    expect(all).not.toContain("Live now");
    expect(all).not.toContain("Ending soon");
    expect(all).toContain("Results");
    expect(all).toContain("Auction alerts");
  });

  it("leads with the live lists that hold something", () => {
    expect(labels({ liveSales: true, endingSoon: true }).slice(0, 2)).toEqual([
      "Live now",
      "Ending soon",
    ]);
  });
});
