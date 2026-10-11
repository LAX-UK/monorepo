import { describe, expect, it } from "vitest";
import { isArtAuthHref } from "./is-art-auth-href.js";

describe("isArtAuthHref", () => {
  it("matches login and register paths", () => {
    expect(isArtAuthHref("/login")).toBe(true);
    expect(isArtAuthHref("/login?returnTo=%2Fcheckout")).toBe(true);
    expect(isArtAuthHref("/register")).toBe(true);
  });

  it("rejects external and non-auth paths", () => {
    expect(isArtAuthHref("//evil.example/login")).toBe(false);
    expect(isArtAuthHref("/account")).toBe(false);
  });
});
