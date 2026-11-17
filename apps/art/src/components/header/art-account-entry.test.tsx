import type { AccountChromeState } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/artworks",
  useRouter: () => ({ push: vi.fn() }),
}));

import { ART_ACCOUNT_SLOT_WIDTH, ArtAccountEntry } from "./art-account-entry";

const GUEST: AccountChromeState = { kind: "guest", loginHref: "/login", registerHref: "/register" };
const SIGNED_IN: AccountChromeState = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  accountHref: "/account",
  logoutHref: "/logout",
};

function render(account: AccountChromeState, replyDot = false, settled = true): string {
  return renderToStaticMarkup(
    <ArtAccountEntry
      account={account}
      settled={settled}
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
    expect(html).toMatch(/data-testid="account-entry-name"[^>]*>Ada</);
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

  it("keeps an empty slot for a disabled or unavailable account, so nothing moves", () => {
    for (const account of [
      { kind: "unavailable", message: "down" },
      { kind: "disabled", message: "off" },
    ] as AccountChromeState[]) {
      const html = render(account);
      expect(html).toContain('data-account-ready="false"');
      expect(html).toContain("invisible");
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("holds the same slot, hidden and inert, until the browser has read the visitor", () => {
    const pending = render(GUEST, true, false);
    expect(pending).toContain('data-testid="art-header-account-slot"');
    expect(pending).toContain('data-account-ready="false"');
    expect(pending).toMatch(/class="[^"]*\binvisible\b/);
    expect(pending).toContain('aria-hidden="true"');
    expect(pending).toContain("inert");
    // The reply dot waits too.
    expect(pending).not.toContain('data-testid="account-entry-attention"');
    expect(render(GUEST)).toContain('data-account-ready="true"');
    expect(render(GUEST)).not.toMatch(/class="[^"]*\binvisible\b/);
  });

  it("gives every visitor the same slot width from 1024px", () => {
    const slotClass = (html: string) =>
      /data-testid="art-header-account-slot"[^>]*class="([^"]*)"/.exec(html)?.[1];
    expect(slotClass(render(GUEST))).toContain(ART_ACCOUNT_SLOT_WIDTH);
    expect(slotClass(render(SIGNED_IN))).toContain(ART_ACCOUNT_SLOT_WIDTH);
    expect(slotClass(render(GUEST, false, false))).toContain(ART_ACCOUNT_SLOT_WIDTH);
  });
});
