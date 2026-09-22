import { describe, expect, it } from "vitest";
import { resolveMagicLinkUrl } from "./magic-link-url.js";

describe("resolveMagicLinkUrl", () => {
  it("uses the issuer verify URL when callback continues a Shop OIDC request", () => {
    const pluginUrl = `http://localhost:3003/api/auth/magic-link/verify?token=abc&callbackURL=${encodeURIComponent(
      "http://localhost:3003/api/auth/oauth2/authorize?client_id=lax-shop-web&response_type=code",
    )}`;
    expect(
      resolveMagicLinkUrl({
        pluginUrl,
        issuerBase: "http://localhost:3003",
        webBase: "http://localhost:3000",
        token: "abc",
      }),
    ).toBe(pluginUrl);
  });

  it("keeps Bid activation URLs when the callback is not an issuer continuation", () => {
    const pluginUrl = `http://localhost:3003/api/auth/magic-link/verify?token=abc&callbackURL=${encodeURIComponent("http://localhost:3000/dashboard")}`;
    expect(
      resolveMagicLinkUrl({
        pluginUrl,
        issuerBase: "http://localhost:3003",
        webBase: "http://localhost:3000",
        token: "abc",
      }),
    ).toBe("http://localhost:3000/auth/activate?token=abc");
  });
});
