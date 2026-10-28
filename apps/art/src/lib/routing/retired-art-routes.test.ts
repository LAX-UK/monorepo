import { describe, expect, it } from "vitest";
import {
  type RetiredArtRouteDestinations,
  followRetiredArtRoute,
  resolveRetiredArtRoute,
} from "./retired-art-routes";

const destinations: RetiredArtRouteDestinations = {
  laxAccountUrl: (destination) => `https://account.test/${destination}`,
  shopBaseUrl: new URL("https://shop.test"),
};

describe("resolveRetiredArtRoute", () => {
  it("sends prints to the editions in LAX Shop", () => {
    expect(resolveRetiredArtRoute("/prints", destinations)).toBe("https://shop.test/artworks");
    expect(resolveRetiredArtRoute("/prints/", destinations)).toBe("https://shop.test/artworks");
  });

  it("keeps prints on lax.art's catalogue when Shop is not configured", () => {
    expect(resolveRetiredArtRoute("/prints", { ...destinations, shopBaseUrl: null })).toBe(
      "/artworks",
    );
  });

  it("sends the collection and payouts to LAX Account", () => {
    expect(resolveRetiredArtRoute("/account/collection", destinations)).toBe(
      "https://account.test/portfolio",
    );
    expect(resolveRetiredArtRoute("/account/payouts", destinations)).toBe(
      "https://account.test/sellingPayouts",
    );
  });

  it("leaves every other path alone", () => {
    for (const path of ["/", "/account", "/account/enquiries", "/paintings", "/prints/x"]) {
      expect(resolveRetiredArtRoute(path, destinations)).toBeNull();
    }
  });
});

describe("followRetiredArtRoute", () => {
  const art = new URL("https://lax.art");

  it("sends a location on a retired page straight to its new home, query kept", () => {
    expect(followRetiredArtRoute("https://lax.art/prints?utm_source=x", art, destinations)).toBe(
      "https://shop.test/artworks?utm_source=x",
    );
  });

  it("leaves other lax.art locations and other origins alone", () => {
    expect(followRetiredArtRoute("https://lax.art/paintings", art, destinations)).toBe(
      "https://lax.art/paintings",
    );
    expect(followRetiredArtRoute("https://lax.bid/prints", art, destinations)).toBe(
      "https://lax.bid/prints",
    );
  });
});
