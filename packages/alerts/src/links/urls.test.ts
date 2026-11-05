import { describe, expect, it } from "vitest";
import { AlertLinkCodec } from "./codec.js";
import { keyringFrom, webAlertUrls } from "./urls.js";

describe("webAlertUrls", () => {
  const urls = webAlertUrls("https://lax.bid/", "https://account.lax.bid/account/alerts");
  it("builds confirm, stop and one-click links on the product's own origin", () => {
    expect(urls.confirm("a.b")).toBe("https://lax.bid/alerts/confirm?t=a.b");
    expect(urls.stop("a.b")).toBe("https://lax.bid/alerts/unsubscribe?t=a.b");
    expect(urls.oneClick("a.b")).toBe(urls.stop("a.b"));
    expect(urls.site("/sales/1")).toBe("https://lax.bid/sales/1");
    expect(urls.manage()).toBe("https://account.lax.bid/account/alerts");
  });

  it("has no manage link for a product without one", () => {
    expect(webAlertUrls("https://lax.bid", null).manage()).toBeNull();
  });
});

describe("keyringFrom", () => {
  it("signs with the new key and still accepts the previous one", () => {
    const old = new AlertLinkCodec(
      keyringFrom({ keyId: "k1", secret: "old-secret-0123456789abcdef" }),
    ); // gitleaks:allow
    const now = new AlertLinkCodec(
      keyringFrom({
        keyId: "k2",
        secret: "new-secret-0123456789abcdef", // gitleaks:allow
        previous: { keyId: "k1", secret: "old-secret-0123456789abcdef" }, // gitleaks:allow
      }),
    );
    const payload = { kind: "stop", product: "bid", subscriberId: "s", linkVersion: 1 } as const;
    expect(now.verify(old.create(payload), new Date())?.payload).toEqual(payload);
    expect(old.verify(now.create(payload), new Date())).toBeNull();
  });
});
