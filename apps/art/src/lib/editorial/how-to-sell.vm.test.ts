import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildSellingRoutes } from "./how-to-sell.vm";

const bid: LaxProductLinkVm = {
  id: "bid",
  label: "LAX Bid",
  href: "https://bid.test/",
  current: false,
  external: true,
};
const laxAccountUrl = (page: string) => `https://account.test/${page}`;

describe("buildSellingRoutes", () => {
  it("sends collectors to Sell with LAX on LAX Bid and artists to the artist portal", () => {
    expect(
      buildSellingRoutes({ crossProductLinks: [bid], laxAccountUrl }).map((route) => [
        route.id,
        route.action.label,
        route.action.href,
      ]),
    ).toEqual([
      ["collector", "Sell with LAX", "https://bid.test/sell"],
      ["artist", "Open the artist portal", "https://account.test/sellingArtworks"],
    ]);
  });

  it("never offers a consignment on lax.art itself", () => {
    const hrefs = buildSellingRoutes({ crossProductLinks: [bid], laxAccountUrl }).map(
      (route) => route.action.href,
    );
    expect(hrefs.every((href) => href.startsWith("https://"))).toBe(true);
  });

  it("leaves the collector route out when LAX Bid is not configured", () => {
    expect(
      buildSellingRoutes({ crossProductLinks: [], laxAccountUrl }).map((route) => route.id),
    ).toEqual(["artist"]);
  });
});
