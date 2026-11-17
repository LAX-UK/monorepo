import type { ArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const chrome = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/components/viewer/art-viewer-chrome.client", () => ({
  useArtViewerChrome: () => chrome.current,
}));

const { ArtFooterAccountList } = await import("./art-footer-account-list.client");

const GUEST = { kind: "guest", loginHref: "/login", registerHref: "/register" } as const;
const SIGNED_IN = {
  kind: "authenticated",
  displayName: "Ada Lovelace",
  email: "ada@example.test",
  accountHref: "/account",
  logoutHref: "/logout",
} as const;

function render(next: ArtViewerChrome): string {
  chrome.current = next;
  return renderToStaticMarkup(<ArtFooterAccountList />);
}

const rows = (html: string) => html.match(/<li/g)?.length ?? 0;

describe("ArtFooterAccountList", () => {
  it("keeps its rows in place, hidden and inert, until the visitor is read", () => {
    const html = render({ account: GUEST, replyDot: false, settled: false });
    expect(html).toContain('data-account-ready="false"');
    expect(html).toMatch(/<ul[^>]*class="[^"]*\binvisible\b/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("inert");
    expect(rows(html)).toBe(2);
  });

  it("shows the visitor's links once read, two rows for everyone", () => {
    const member = render({ account: SIGNED_IN, replyDot: false, settled: true });
    expect(member).toContain(">Your account<");
    expect(member).not.toMatch(/<ul[^>]*class="[^"]*\binvisible\b/);
    expect(rows(member)).toBe(2);

    const guest = render({ account: GUEST, replyDot: false, settled: true });
    expect(guest).toContain(">Sign in<");
    expect(rows(guest)).toBe(2);

    // One link, and an empty row so the footer keeps its height.
    const disabled = render({
      account: { kind: "disabled", message: "off" },
      replyDot: false,
      settled: true,
    });
    expect(disabled).toContain(">Account status<");
    expect(rows(disabled)).toBe(2);
  });
});
