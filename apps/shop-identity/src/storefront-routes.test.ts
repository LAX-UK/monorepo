import { describe, expect, it } from "vitest";
import { shopStorefrontPath } from "./storefront-routes.js";

describe("shopStorefrontPath", () => {
  const env = { SHOP_STOREFRONT_URL: "http://localhost:3020" };

  it("builds fixed storefront URLs without request input", () => {
    expect(shopStorefrontPath(env, "/account")).toBe("http://localhost:3020/account");
    expect(shopStorefrontPath(env, "account/disabled")).toBe(
      "http://localhost:3020/account/disabled",
    );
  });

  it("strips trailing slashes from the configured base", () => {
    expect(shopStorefrontPath({ SHOP_STOREFRONT_URL: "http://localhost:3020/" }, "/")).toBe(
      "http://localhost:3020/",
    );
  });
});
