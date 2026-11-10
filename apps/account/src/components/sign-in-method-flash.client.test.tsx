// @vitest-environment jsdom
import { buildSignInMethodFlash } from "@/server/domain/account-sign-in-methods.vm";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInMethodFlash } from "./sign-in-method-flash.client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function flashFor(word: string) {
  const flash = buildSignInMethodFlash(word, undefined, {
    linked: ["google", "apple"],
    passkeys: 1,
  });
  if (!flash) throw new Error(`no notice for ${word}`);
  return flash;
}

function show(word: string) {
  return render(
    <SignInMethodFlash
      flash={flashFor(word)}
      pagePath="/account/security"
      reauthHref="/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth"
    />,
  );
}

describe("SignInMethodFlash", () => {
  it("announces a success politely, and takes focus", () => {
    show("google_linked");
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("Google is linked");
    expect(notice.textContent).toContain("You can now sign in with it.");
    expect(document.activeElement).toBe(notice);
  });

  it("announces a problem as an alert, and takes focus", () => {
    show("already_linked_elsewhere");
    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("already linked to another LAX Account");
    expect(document.activeElement).toBe(notice);
  });

  it("takes the word out of the address, so a refresh does not show it again", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    window.history.pushState(null, "", "/account/security?signInMethod=google_linked");
    show("google_linked");
    expect(replace.mock.calls.at(-1)?.slice(1)).toEqual(["", "/account/security"]);
    expect(window.location.search).toBe("");
  });

  it("offers a fresh sign-in only when that is the fix", () => {
    show("reauth_required");
    const link = screen.getByRole("link", { name: "Sign in again" });
    expect(link.getAttribute("href")).toBe(
      "/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth",
    );
    cleanup();
    show("rate_limited");
    expect(screen.queryByRole("link", { name: "Sign in again" })).toBeNull();
  });

  it("is a notice with a heading, not a toast that disappears", () => {
    show("cancelled");
    expect(screen.getByRole("heading", { level: 3, name: "Linking was cancelled" })).toBeTruthy();
  });

  it("carries no animation, so reduced motion has nothing to turn off", () => {
    show("google_linked");
    expect(screen.getByRole("status").className).not.toMatch(/animate|transition/);
  });
});
