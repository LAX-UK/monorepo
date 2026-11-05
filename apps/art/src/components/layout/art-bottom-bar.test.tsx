import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { ArtBottomBar } from "./art-bottom-bar.client";

function render(path: string, props: { signedOut?: boolean; replyDot?: boolean } = {}): string {
  pathname = path;
  return renderToStaticMarkup(
    <ArtBottomBar signedOut={props.signedOut ?? false} replyDot={props.replyDot ?? false} />,
  );
}

function tab(html: string, label: string): string {
  const match = html.match(
    new RegExp(`<(?:a|button)[^>]*>(?:(?!</(?:a|button)>).)*${label}.*?</(?:a|button)>`),
  );
  return match?.[0] ?? "";
}

describe("ArtBottomBar", () => {
  it("renders the docked bar with the five tabs", () => {
    const html = render("/");
    expect(html).toContain('data-testid="art-bottom-tab-bar"');
    for (const label of ["Home", "Artworks", "Search", "Favourites", "Account"]) {
      expect(html).toContain(`<span>${label}</span>`);
    }
    expect(html).not.toContain("Discover");
    expect(html).not.toContain('data-variant="floating"');
  });

  it.each([
    ["/", "Home"],
    ["/artworks", "Artworks"],
    ["/paintings", "Artworks"],
    ["/sculptures", "Artworks"],
    ["/account/favourites", "Favourites"],
    ["/account", "Account"],
  ])("marks only the matching tab current on %s", (path, label) => {
    const html = render(path);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(tab(html, label)).toContain('aria-current="page"');
  });

  it("marks no tab current on the search results page", () => {
    expect(render("/search")).not.toContain("aria-current");
  });

  it("makes Search a button, not a link", () => {
    const html = render("/");
    expect(tab(html, "Search")).toMatch(/^<button/);
    expect(tab(html, "Search")).toContain('aria-haspopup="dialog"');
  });

  it("signed out, sends Favourites and Account to Sign in with a return path", () => {
    const html = render("/artworks", { signedOut: true });
    expect(tab(html, "Favourites")).toContain('href="/login?returnTo=%2Faccount%2Ffavourites"');
    expect(tab(html, "Account")).toContain('href="/login?returnTo=%2Faccount"');
  });

  it("signed in, links straight to the account pages", () => {
    const html = render("/artworks");
    expect(tab(html, "Favourites")).toContain('href="/account/favourites"');
    expect(tab(html, "Account")).toContain('href="/account"');
  });

  it("signed in, draws the person's initials as the Account icon", () => {
    pathname = "/artworks";
    const html = renderToStaticMarkup(
      <ArtBottomBar
        signedOut={false}
        replyDot={false}
        viewer={{ displayName: "Alex Collector", email: "alex@example.com" }}
      />,
    );
    expect(tab(html, "Account")).toContain(">AC<");
  });

  it("shows a dot on Account for a reply, and says so to screen readers", () => {
    const html = render("/artworks", { replyDot: true });
    expect(html).toContain('data-testid="tab-badge-Account"');
    expect(tab(html, "Account")).toContain('aria-label="Account, needs attention"');
    expect(render("/artworks")).not.toContain("tab-badge-Account");
  });
});
