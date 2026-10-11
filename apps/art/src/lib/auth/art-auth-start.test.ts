import { describe, expect, it } from "vitest";
import { artIdentityAuthStartHref } from "./art-auth-start.js";

describe("artIdentityAuthStartHref", () => {
  it("forwards a relative return path to art-identity", () => {
    expect(
      artIdentityAuthStartHref("http://localhost:3051/", "login", "/artworks/a?enquire=1"),
    ).toBe("http://localhost:3051/login?returnTo=%2Fartworks%2Fa%3Fenquire%3D1");
  });

  it("drops open-redirect attempts", () => {
    expect(artIdentityAuthStartHref("http://localhost:3051", "register", "//evil.test")).toBe(
      "http://localhost:3051/register",
    );
    expect(artIdentityAuthStartHref("http://localhost:3051", "login", undefined)).toBe(
      "http://localhost:3051/login",
    );
  });
});
