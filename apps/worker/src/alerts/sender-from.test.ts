import { describe, expect, it } from "vitest";
import { fromForProduct } from "./sender-from.js";

const fallback = "LAX <no-reply@mail.lax.bid>";

describe("fromForProduct", () => {
  it("falls back to the service's From when nothing is configured for the product", () => {
    expect(fromForProduct("bid", undefined, fallback)).toBe(fallback);
    expect(fromForProduct("shop", { bid: "alerts@mail.lax.bid" }, fallback)).toBe(fallback);
    expect(fromForProduct("shop", { shop: "  " }, fallback)).toBe(fallback);
  });

  it("sends a bare address under the product's name", () => {
    const map = {
      bid: "alerts@mail.lax.bid",
      shop: "alerts@mail.lax.art",
      art: "alerts@mail.lax.art",
    };
    expect(fromForProduct("bid", map, fallback)).toBe("LAX Bid <alerts@mail.lax.bid>");
    expect(fromForProduct("shop", map, fallback)).toBe("LAX Shop <alerts@mail.lax.art>");
    expect(fromForProduct("art", map, fallback)).toBe("lax.art <alerts@mail.lax.art>");
  });

  it("uses a full From as written", () => {
    expect(fromForProduct("bid", { bid: "LAX Bid Alerts <a@mail.lax.bid>" }, fallback)).toBe(
      "LAX Bid Alerts <a@mail.lax.bid>",
    );
  });
});
