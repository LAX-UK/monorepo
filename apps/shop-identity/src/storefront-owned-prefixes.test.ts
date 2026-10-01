import { describe, expect, it } from "vitest";
import {
  assertStorefrontRedirectNotIdentityOwned,
  isShopIdentityOwnedStorefrontPath,
} from "./storefront-owned-prefixes.js";

describe("storefront-owned-prefixes", () => {
  it("marks identity-owned paths", () => {
    expect(isShopIdentityOwnedStorefrontPath("/auth/callback")).toBe(true);
    expect(isShopIdentityOwnedStorefrontPath("/sign-in-error")).toBe(false);
  });

  it("rejects storefront redirects into identity-owned paths", () => {
    expect(() =>
      assertStorefrontRedirectNotIdentityOwned("http://localhost:3020/auth/callback?error=x"),
    ).toThrow(/shop-identity path/);
    expect(() =>
      assertStorefrontRedirectNotIdentityOwned(
        "http://localhost:3020/sign-in-error?reason=invalid_state",
      ),
    ).not.toThrow();
  });
});
