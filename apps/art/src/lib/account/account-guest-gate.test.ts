import { accountReturnPath, guestAccountRedirect } from "@/lib/account/account-guest-gate";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import { describe, expect, it } from "vitest";

const guest = {
  kind: "guest",
  loginHref: "/login",
  registerHref: "/register",
} as unknown as ArtViewerState;
const authenticated = { kind: "authenticated" } as unknown as ArtViewerState;
const disabled = { kind: "disabled" } as unknown as ArtViewerState;

describe("guestAccountRedirect", () => {
  it("sends a signed-out visitor to sign-in and back to the page they asked for", () => {
    expect(guestAccountRedirect(guest, "/account/favourites")).toBe(
      "/login?returnTo=%2Faccount%2Ffavourites",
    );
  });

  it("lets signed-in, disabled and unavailable viewers continue to the page", () => {
    expect(guestAccountRedirect(authenticated, "/account")).toBeNull();
    expect(guestAccountRedirect(disabled, "/account")).toBeNull();
  });

  it("falls back to the account home when the requested path is missing or not local", () => {
    expect(accountReturnPath(undefined)).toBe("/account");
    expect(accountReturnPath("https://evil.example/account")).toBe("/account");
    expect(accountReturnPath("//evil.example")).toBe("/account");
  });
});
