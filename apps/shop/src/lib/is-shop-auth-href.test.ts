import { describe, expect, it } from "vitest";
import { isShopAuthHref } from "./is-shop-auth-href.js";

describe("isShopAuthHref", () => {
  it("matches login and register paths", () => {
    expect(isShopAuthHref("/login")).toBe(true);
    expect(isShopAuthHref("/login?returnTo=%2Fcheckout")).toBe(true);
    expect(isShopAuthHref("/register")).toBe(true);
  });

  it("rejects external and non-auth paths", () => {
    expect(isShopAuthHref("//evil.example/login")).toBe(false);
    expect(isShopAuthHref("/account")).toBe(false);
  });
});
