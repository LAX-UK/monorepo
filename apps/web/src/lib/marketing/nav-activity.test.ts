import { getMarketingMegaMenuSections } from "@/lib/marketing/mega-menu-catalog";
import { NO_NAV_ACTIVITY, applyNavActivity } from "@/lib/marketing/nav-activity";
import { describe, expect, it } from "vitest";

function auctionLabels(activity: Parameters<typeof applyNavActivity>[1]): string[] {
  const sections = applyNavActivity(getMarketingMegaMenuSections(), activity);
  return sections.find((s) => s.id === "auctions")?.items.map((i) => i.label) ?? [];
}

describe("applyNavActivity", () => {
  it("keeps the main navigation in the approved order", () => {
    const ids = applyNavActivity(getMarketingMegaMenuSections(), NO_NAV_ACTIVITY).map((s) => s.id);
    expect(ids).toEqual(["auctions", "results", "artists", "sell"]);
  });

  it("leaves out the live lists when nothing is live or ending", () => {
    expect(auctionLabels(NO_NAV_ACTIVITY)).toEqual([
      "Upcoming auctions",
      "Auction calendar",
      "Auction alerts",
    ]);
  });

  it("adds Live now and Ending soon only for the lists that hold something", () => {
    expect(auctionLabels({ liveSales: true, endingSoon: false })).toContain("Live now");
    expect(auctionLabels({ liveSales: true, endingSoon: false })).not.toContain("Ending soon");
    expect(auctionLabels({ liveSales: false, endingSoon: true })).toContain("Ending soon");
    expect(auctionLabels({ liveSales: false, endingSoon: true })).not.toContain("Live now");
  });

  it("returns plain links without the marker", () => {
    const all = applyNavActivity(getMarketingMegaMenuSections(), {
      liveSales: true,
      endingSoon: true,
    });
    for (const item of all.flatMap((s) => s.items)) expect(item).not.toHaveProperty("requires");
  });

  it("names the seller area Selling", () => {
    const sell = getMarketingMegaMenuSections().find((s) => s.id === "sell");
    const labels = sell?.items.map((i) => i.label);
    expect(labels).toContain("Selling");
    expect(labels).not.toContain("Seller dashboard");
  });
});
