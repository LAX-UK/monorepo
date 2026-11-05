import type { AccountChromeState } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
  useRouter: () => ({ push: vi.fn() }),
}));

import { ArtAccountEntry } from "./art-account-entry";

const GUEST: AccountChromeState = { kind: "guest", loginHref: "/login", registerHref: "/register" };
const SIGNED_IN: AccountChromeState = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  accountHref: "/account",
  logoutHref: "/logout",
};

function render(account: AccountChromeState, replyDot = false): string {
  return renderToStaticMarkup(
    <ArtAccountEntry
      account={account}
      productLinks={[]}
      pathname="/artworks"
      headerTone="on-light"
      replyDot={replyDot}
    />,
  );
}

describe("ArtAccountEntry (desktop header row)", () => {
  it("shows 'Account' for a signed-out visitor, not a Sign in link", () => {
    const html = render(GUEST);
    expect(html).toContain('data-testid="art-header-desktop-account"');
    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain("<span>Account</span>");
    expect(html).not.toContain(">Sign in<");
  });

  it("shows the avatar initials and first name once signed in", () => {
    const html = render(SIGNED_IN);
    expect(html).toContain('aria-label="Account menu, Ada Lovelace"');
    expect(html).toContain(">AL<");
    expect(html).toContain('data-testid="account-entry-name">Ada<');
  });

  it("adds the reply dot to the entry", () => {
    expect(render(SIGNED_IN, true)).toContain('data-testid="account-entry-attention"');
    expect(render(SIGNED_IN, false)).not.toContain('data-testid="account-entry-attention"');
  });

  it("offers the tablet trigger for the account sheet from 768px to 1023px", () => {
    const html = render(GUEST);
    expect(html).toContain('data-testid="art-header-tablet-account"');
    expect(html).toContain("lg:hidden");
  });

  it("renders nothing for a disabled or unavailable account", () => {
    expect(render({ kind: "unavailable", message: "down" })).toBe("");
    expect(render({ kind: "disabled", message: "off" })).toBe("");
  });
});
