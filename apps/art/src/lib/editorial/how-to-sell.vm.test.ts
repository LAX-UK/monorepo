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
  it("sends collectors to Sell with LAX on LAX Bid and artists to For artists", () => {
    expect(
      buildSellingRoutes({ crossProductLinks: [bid], laxAccountUrl }).map((route) => [
        route.id,
        route.action.label,
        route.action.href,
      ]),
    ).toEqual([
      ["collector", "Sell with LAX", "https://bid.test/sell"],
      ["artist", "Apply to join", "/for-artists"],
    ]);
  });

  it("never offers a consignment on lax.art itself", () => {
    const collector = buildSellingRoutes({ crossProductLinks: [bid], laxAccountUrl }).find(
      (route) => route.id === "collector",
    );
    expect(collector?.action.href.startsWith("https://bid.test")).toBe(true);
  });

  it("leaves the collector route out when LAX Bid is not configured", () => {
    expect(
      buildSellingRoutes({ crossProductLinks: [], laxAccountUrl }).map((route) => route.id),
    ).toEqual(["artist"]);
  });
});
