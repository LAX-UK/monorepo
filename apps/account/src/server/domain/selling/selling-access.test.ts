import { describe, expect, it } from "vitest";
import {
  UNKNOWN_SELLER_ACCESS,
  firstSellingTool,
  opensSellingTool,
  sellerAccessFromRead,
  showsSelling,
} from "./selling-access";
import { buildSellingTabs } from "./selling-routes";

const buyer = sellerAccessFromRead({
  status: "ok",
  data: { editions: false, payouts: false, artist: false },
});
const seller = sellerAccessFromRead({
  status: "ok",
  data: { editions: true, payouts: true, artist: false },
});
const artist = sellerAccessFromRead({
  status: "ok",
  data: { editions: false, payouts: false, artist: true },
});

describe("seller access", () => {
  it("never shows Selling to a plain buyer, or when Shop has the tools switched off", () => {
    expect(showsSelling(buyer)).toBe(false);
    expect(showsSelling(sellerAccessFromRead({ status: "off" }))).toBe(false);
    expect(showsSelling(null)).toBe(false);
  });

  it("shows Selling to anyone holding a seller role", () => {
    expect(showsSelling(seller)).toBe(true);
    expect(showsSelling(artist)).toBe(true);
  });

  it("hides the menu entry when the lookup fails, but never locks a seller out", () => {
    const failed = sellerAccessFromRead({ status: "unavailable" });
    expect(failed).toEqual(UNKNOWN_SELLER_ACCESS);
    expect(showsSelling(failed)).toBe(false);
    expect(opensSellingTool(failed, "payouts")).toBe(true);
    expect(opensSellingTool(buyer, "payouts")).toBe(false);
  });

  it("opens the first tool the person holds", () => {
    expect(firstSellingTool(seller)).toBe("editions");
    expect(firstSellingTool(artist)).toBe("artworks");
    expect(firstSellingTool(UNKNOWN_SELLER_ACCESS)).toBe("editions");
    expect(firstSellingTool(buyer)).toBeNull();
  });
});

describe("buildSellingTabs", () => {
  it("lists the person's tools with the current one marked", () => {
    expect(buildSellingTabs(seller, "sales").map((tab) => [tab.label, tab.current])).toEqual([
      ["Editions", false],
      ["Sales", true],
      ["Payouts", false],
    ]);
  });

  it("shows no tabs when there is only one page to be on", () => {
    expect(buildSellingTabs(artist, "artworks")).toEqual([]);
    expect(buildSellingTabs(UNKNOWN_SELLER_ACCESS, "payouts")).toEqual([]);
  });
});
