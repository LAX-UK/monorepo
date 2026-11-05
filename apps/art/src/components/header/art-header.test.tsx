import type { AccountChromeState, LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/enquiry/art-general-enquiry-actions.server", () => ({
  sendArtGeneralEnquiry: vi.fn(),
}));

import { ArtHeaderClient } from "./art-header.client";

const GUEST: AccountChromeState = { kind: "guest", loginHref: "/login", registerHref: "/register" };
const SIGNED_IN: AccountChromeState = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  accountHref: "/account",
  logoutHref: "/logout",
};
const FAMILY: LaxFamilyLinkVm[] = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: true },
  { id: "shop", label: "lax.shop", href: "https://shop.example.test", current: false },
  { id: "account", label: "LAX Account", href: "https://account.lax", current: false },
] as LaxFamilyLinkVm[];

function render(account: AccountChromeState, replyDot = false): string {
  return renderToStaticMarkup(
    <ArtHeaderClient
      account={account}
      productLinks={[]}
      familyLinks={FAMILY}
      headerNav={null}
      replyDot={replyDot}
    />,
  );
}

function topBar(html: string): string {
  const start = html.indexOf('data-testid="lax-family-bar"');
  const end = html.indexOf("</header>");
  const bar = html.slice(start, end);
  // The bar is the first block of the header; it ends where the main row begins.
  return bar.slice(0, bar.indexOf("top-bar-slots"));
}

describe("ArtHeaderClient", () => {
  it("puts Visit us, Enquire and Help on the right of the top bar", () => {
    const html = render(GUEST);
    const bar = topBar(html);
    const help = bar.slice(bar.indexOf('aria-label="Help"'));
    expect(help.indexOf("Visit us")).toBeGreaterThan(-1);
    expect(help.indexOf("Visit us")).toBeLessThan(help.indexOf("Enquire"));
    expect(help.indexOf("Enquire")).toBeLessThan(help.indexOf(">Help<"));
    expect(help).toContain('href="/visit"');
    expect(help).toContain('href="/contact"');
    expect(help).toContain('href="/help"');
  });

  it("opens the enquiry sheet from the top bar's Enquire when signed in", () => {
    const bar = topBar(render(SIGNED_IN));
    expect(bar).toContain("<button");
    expect(bar).toMatch(/<button[^>]*>Enquire<\/button>/);
    expect(bar).not.toContain('href="/contact"');
  });

  it("keeps the theme control, Sign in and the account menu out of the top bar", () => {
    const bar = topBar(render(GUEST));
    expect(bar).not.toContain("theme");
    expect(bar).not.toContain("Sign in");
    expect(bar).not.toContain("Account menu");
  });

  it("puts Account in the header row, with the theme control after search", () => {
    const html = render(GUEST);
    const row = html.slice(html.indexOf('data-testid="top-bar-slots"'));
    const search = row.indexOf('data-slot="search-field"');
    const theme = row.indexOf("Switch to dark theme");
    const account = row.indexOf('data-slot="account"');
    expect(search).toBeGreaterThan(-1);
    expect(theme).toBeGreaterThan(search);
    expect(account).toBeGreaterThan(theme);
    expect(row).toContain('data-testid="art-header-desktop-account"');
  });

  it("shows the search field placeholder from 1280px", () => {
    const html = render(GUEST);
    const field = html.slice(html.indexOf('data-slot="search-field"'));
    expect(field.slice(0, field.indexOf('data-slot="search-icon"'))).toContain(
      "Search artworks and artists",
    );
  });

  it("uses the shared lockup sizes: wordmark 40px, phone mark 28px with the .ART tag", () => {
    const html = render(GUEST);
    expect(html).toContain("--lockup-h:40px");
    expect(html).toContain("--lockup-h:28px");
    expect(html).toContain(">.ART<");
  });

  it("carries a menu button that only shows below 1024px", () => {
    const html = render(GUEST);
    const button = html.match(/<button[^>]*aria-label="Open menu"[^>]*>/)?.[0] ?? "";
    expect(button).toContain("lg:hidden");
  });

  it("passes the reply dot to the account entry", () => {
    expect(render(SIGNED_IN, true)).toContain('data-testid="account-entry-attention"');
    expect(render(SIGNED_IN, false)).not.toContain('data-testid="account-entry-attention"');
  });
});
