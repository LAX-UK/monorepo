import { AlertLinkCodec } from "@auction/alerts";
import { isReleaseAlertToken } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { artAlertUrls, shopAlertUrls } from "./shop-alert-urls.js";

describe("alert links", () => {
  it("point LAX Shop's links at the pages Shop already serves", () => {
    const urls = shopAlertUrls("https://shop.example/", "https://account.example/account/alerts");
    expect(urls.confirm("a.b")).toBe("https://shop.example/release-alerts/confirm?token=a.b");
    expect(urls.stop("a.b")).toBe("https://shop.example/release-alerts/unsubscribe?token=a.b");
    expect(urls.oneClick("a.b")).toBe(urls.stop("a.b"));
    expect(urls.site("/artworks/x")).toBe("https://shop.example/artworks/x");
    expect(urls.manage()).toBe("https://account.example/account/alerts");
    expect(shopAlertUrls("https://shop.example").manage()).toBeNull();
  });

  it("point lax.art's stop link at lax.art, never at Shop", () => {
    const urls = artAlertUrls("https://lax.art", "https://account.example/account/alerts");
    expect(urls.stop("a.b")).toBe("https://lax.art/alerts/unsubscribe?token=a.b");
    expect(urls.site("/artworks/x")).toBe("https://lax.art/artworks/x");
    expect(urls.manage()).toBe("https://account.example/account/alerts");
  });

  it("carry a signed token the Shop pages accept", () => {
    const key = { id: "k1", secret: "test-secret-0123456789abcdef" }; // gitleaks:allow
    const codec = new AlertLinkCodec({ signing: key, accepted: [key] });
    const token = codec.create({
      kind: "stop",
      product: "art",
      subscriberId: "5f0c0a52-9d2b-4a61-8d77-6f5a0f1f2c3d",
      linkVersion: 1,
      topic: "art.followed_artists",
    });
    expect(isReleaseAlertToken(token)).toBe(true);
    const confirm = codec.create({
      kind: "confirm",
      product: "shop",
      subscriberId: "5f0c0a52-9d2b-4a61-8d77-6f5a0f1f2c3d",
      linkVersion: 3,
      requestedAtMs: Date.now(),
    });
    expect(isReleaseAlertToken(confirm)).toBe(true);
  });

  it("still accept the 43-character token older emails carry, and refuse anything else", () => {
    expect(isReleaseAlertToken("a".repeat(43))).toBe(true);
    expect(isReleaseAlertToken("a".repeat(42))).toBe(false);
    expect(isReleaseAlertToken("")).toBe(false);
    expect(isReleaseAlertToken("a.b")).toBe(false);
    expect(isReleaseAlertToken(`${"a".repeat(30)}.${"b".repeat(42)}`)).toBe(false);
  });
});
