import { describe, expect, it } from "vitest";
import {
  LOCKUP_HEIGHTS,
  PHONE_LOCKUP_TAGS,
  desktopLockupHeight,
} from "../src/lockup/lockup-heights.js";

describe("lockup heights", () => {
  it("fixes the desktop and phone heights", () => {
    expect(LOCKUP_HEIGHTS.desktopMark).toBe(38);
    expect(LOCKUP_HEIGHTS.desktopBid).toBe(40);
    expect(LOCKUP_HEIGHTS.desktopShop).toBe(50);
    expect(LOCKUP_HEIGHTS.desktopArt).toBe(40);
    expect(LOCKUP_HEIGHTS.phoneMark).toBe(28);
  });

  it("resolves a product's desktop height", () => {
    expect(desktopLockupHeight("bid")).toBe(40);
    expect(desktopLockupHeight("shop")).toBe(50);
    expect(desktopLockupHeight("art")).toBe(40);
  });

  it("tags the phone mark with the product", () => {
    expect(PHONE_LOCKUP_TAGS).toEqual({ bid: ".BID", shop: ".SHOP", art: ".ART" });
  });
});
