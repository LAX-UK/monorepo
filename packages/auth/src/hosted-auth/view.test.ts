import { describe, expect, it } from "vitest";
import { hostedAuthViewFromSearch, resolveHostedProductBackLink } from "./view.js";

describe("resolveHostedProductBackLink", () => {
  it("links Shop sign-in back to the storefront", () => {
    const view = hostedAuthViewFromSearch("client_id=lax-shop-web");
    expect(resolveHostedProductBackLink(view)).toEqual({
      href: "http://localhost:3020",
      label: "Back to LAX Shop",
    });
  });

  it("omits the back link for Shop Admin because its home requires sign-in", () => {
    const view = hostedAuthViewFromSearch("client_id=lax-shop-admin");
    expect(view.flow.product).toBe("shop-admin");
    expect(resolveHostedProductBackLink(view)).toBeNull();
  });
});
