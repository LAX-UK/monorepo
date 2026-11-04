// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EssentialCookiesDialog } from "./essential-cookies-dialog.js";
import { COOKIE_SETTINGS_HASH } from "./footer-legal-column.js";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

function openFromFooterLink() {
  act(() => {
    window.history.replaceState(null, "", `/${COOKIE_SETTINGS_HASH}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("EssentialCookiesDialog", () => {
  it("stays closed until the cookie settings link is followed", () => {
    render(<EssentialCookiesDialog productName="LAX Shop" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the footer link, says only essential cookies are used and clears the hash", () => {
    render(<EssentialCookiesDialog productName="LAX Shop" cookiePolicyHref="/cookies" />);
    openFromFooterLink();
    const dialog = screen.getByRole("dialog", { name: "Cookie settings" });
    expect(dialog.textContent).toContain("LAX Shop uses only the cookies it needs to work");
    expect(screen.getByRole("link", { name: "Read the cookie policy" }).getAttribute("href")).toBe(
      "/cookies",
    );
    expect(window.location.hash).toBe("");
  });

  it("opens when the page loads with the hash, and closes with Close", () => {
    window.history.replaceState(null, "", `/${COOKIE_SETTINGS_HASH}`);
    render(<EssentialCookiesDialog productName="lax.art" />);
    expect(screen.getByRole("dialog", { name: "Cookie settings" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Read the cookie policy" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0] as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
