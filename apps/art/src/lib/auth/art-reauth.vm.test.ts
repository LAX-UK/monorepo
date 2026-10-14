import { describe, expect, it } from "vitest";
import { artSignInHref, buildArtReauthVm, resolveArtReauthReturnTo } from "./art-reauth.vm.js";

describe("resolveArtReauthReturnTo", () => {
  it.each([
    ["/artworks/warm-basket", "/artworks/warm-basket"],
    ["/account/favourites?tab=saved", "/account/favourites?tab=saved"],
    [["/artists", "/account"], "/artists"],
  ] as const)("keeps same-origin relative path %j", (raw, expected) => {
    expect(resolveArtReauthReturnTo(raw as string | string[], "/")).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "artworks",
    "/login?returnTo=%2F",
    "/register",
    "/logout",
    "/auth/callback",
    "/signed-out",
    "/session-expired?returnTo=%2Fsigned-out",
    "/sign-in-error?reason=invalid_state",
    "/artworks/../login",
  ])("falls back for %j", (raw) => {
    expect(resolveArtReauthReturnTo(raw, "/account")).toBe("/account");
  });

  it("does not treat lookalike paths as auth routes", () => {
    expect(resolveArtReauthReturnTo("/login-help", "/")).toBe("/login-help");
  });
});

describe("artSignInHref", () => {
  it("returns header sign-in to the current page", () => {
    expect(artSignInHref("/artworks/warm-basket")).toBe(
      "/login?returnTo=%2Fartworks%2Fwarm-basket",
    );
  });

  it("does not return to the session status page the viewer signed in from", () => {
    expect(artSignInHref("/signed-out")).toBe("/login?returnTo=%2F");
  });
});

describe("buildArtReauthVm", () => {
  it("sends Sign in again through the storefront login route with the safe return path", () => {
    expect(buildArtReauthVm("/account/enquiries", "/")).toEqual({
      signInHref: "/login?returnTo=%2Faccount%2Fenquiries",
      continueHref: "/artworks",
    });
  });

  it("uses the fallback return path when the query is unsafe", () => {
    expect(buildArtReauthVm("https://evil.example", "/account").signInHref).toBe(
      "/login?returnTo=%2Faccount",
    );
  });
});
