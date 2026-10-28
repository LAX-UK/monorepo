import { describe, expect, it } from "vitest";
import { type RetiredArtRouteDestinations, resolveRetiredArtRoute } from "./retired-art-routes";

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
