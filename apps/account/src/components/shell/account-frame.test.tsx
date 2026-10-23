import { buildAccountNav, buildProductBar } from "@/server/domain/account-nav.vm";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountFrame } from "./account-frame";

// Radix's popover and dialog run positioning and focus-trap loops that stall the test runner when
// they mount. These stand-ins render the content as if open, so the tests read what each one holds.
vi.mock("@auction/ui/components/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="avatar-menu">{children}</div>
  ),
}));
vi.mock("@auction/ui/components/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="menu-sheet">{children}</div>
  ),
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/portfolio/money" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const config = {
  bidPublicUrl: "https://lax.bid",
  laxArtPublicUrl: "https://lax.art",
  shopPublicUrl: "https://shop.lax.bid",
};
const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};
const viewer = {
  displayName: "Ada Lovelace",
  name: "Ada Lovelace",
  email: "ada@example.com",
  initials: "AL",
};

function render(signedIn: boolean) {
  return renderToStaticMarkup(
    <AccountFrame
      viewer={signedIn ? viewer : null}
      nav={signedIn ? buildAccountNav({ support }) : []}
      products={buildProductBar(config)}
      support={support}
    >
      <p>Page body</p>
    </AccountFrame>,
  );
}

describe("AccountFrame signed in", () => {
  const html = render(true);

  it("shows the product bar with Account as the current product", () => {
    expect(html).toContain('aria-label="LAX products"');
    for (const label of ["LAX Bid", "LAX Art", "LAX Shop", "LAX Account"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/aria-current="page"[^>]*>LAX Account</);
  });

  it("wears the Account Centre lockup, a theme toggle and the avatar menu", () => {
    expect(html).toContain('aria-label="LAX Account"');
    expect(html).toContain("Switch to dark theme");
    expect(html).toContain('aria-label="Account menu for Ada Lovelace"');
    expect(html).toContain("ada@example.com");
    expect(html).toContain('action="/api/auth/logout"');
    expect(html).toContain("Sign out");
  });

  it("has an Account navigation landmark with the seven destinations and the current one marked", () => {
    expect(html).toContain('<nav aria-label="Account"');
    for (const label of [
      "Home",
      "Personal details",
      "Security",
      "Portfolio",
      "Money",
      "Privacy",
      "Help",
    ]) {
      expect(html).toContain(label);
    }
    // The path is the Money page, so Money alone is current (in the rail and in the sheet).
    expect(html.split('href="/account/portfolio/money" aria-current="page"')).toHaveLength(3);
    expect(html).not.toContain('href="/account/portfolio" aria-current');
  });

  it("offers the same menu in a sheet opened from the header, with the other products", () => {
    expect(html).toContain('aria-label="Open menu"');
    const sheet = html.slice(html.indexOf('data-testid="menu-sheet"'));
    expect(sheet).toContain("Personal details");
    expect(sheet).toContain("LAX Bid");
    expect(sheet).toContain("Sign out");
  });

  it("keeps a minimal footer with privacy and help and renders the page body", () => {
    expect(html).toContain("Page body");
    expect(html).toContain('href="https://lax.bid/privacy"');
    expect(html).toContain('href="https://lax.bid/faq"');
  });
});

describe("AccountFrame signed out", () => {
  const html = render(false);

  it("has no menu, avatar or sheet, and offers Sign in", () => {
    expect(html).not.toContain('<nav aria-label="Account"');
    expect(html).not.toContain("Account menu for");
    expect(html).not.toContain('aria-label="Open menu"');
    expect(html).toContain("Sign in");
  });
});
