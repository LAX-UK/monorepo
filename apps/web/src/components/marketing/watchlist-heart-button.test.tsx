import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/ui/overlay-tone-context", () => ({
  useOverlayTone: () => ({ tone: "light", kind: "frosted" }),
  useOverlayToneContext: () => null,
}));

describe("MarketingWatchlistHeart", () => {
  it("renders a button (not a link) when logged out so lot cards avoid nested anchors", () => {
    render(
      <MarketingWatchlistHeart
        lotId="lot-1"
        lotTitle="The Amber Hours"
        initialWatching={false}
        isAuthenticated={false}
        loginNextPath="/search?offset=0&view=grid"
      />,
    );

    const control = screen.getByRole("button", {
      name: "Sign in to add The Amber Hours to your watchlist",
    });
    expect(control.tagName).toBe("BUTTON");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("navigates to login with next param without bubbling to the card link", () => {
    push.mockClear();
    const parentClick = vi.fn();

    render(
      <a href="/lot/test" onClick={parentClick}>
        <MarketingWatchlistHeart
          lotId="lot-1"
          lotTitle="The Amber Hours"
          initialWatching={false}
          isAuthenticated={false}
          loginNextPath="/search?offset=0&view=grid"
        />
      </a>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Sign in to add The Amber Hours to your watchlist",
      }),
    );

    expect(push).toHaveBeenCalledWith("/login?next=%2Fsearch%3Foffset%3D0%26view%3Dgrid");
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("applies frosted overlay chrome when surface is onImage outside AdaptiveMediaFrame", () => {
    render(
      <MarketingWatchlistHeart
        lotId="lot-1"
        lotTitle="The Amber Hours"
        initialWatching={false}
        isAuthenticated={false}
        loginNextPath="/"
        layout="inline"
        surface="onImage"
      />,
    );

    const control = screen.getByRole("button", {
      name: "Sign in to add The Amber Hours to your watchlist",
    });
    expect(control).toHaveAttribute("data-overlay-tone", "light");
    expect(control.className).toContain("backdrop-blur-sm");
    expect(control.className).toContain("bg-[color:var(--overlay-bg)]");
  });

  it("forwards overlay tone attrs to WatchlistHeart when authenticated", () => {
    render(
      <MarketingWatchlistHeart
        lotId="lot-1"
        lotTitle="The Amber Hours"
        initialWatching={false}
        isAuthenticated={true}
        loginNextPath="/"
        layout="inline"
        surface="onImage"
      />,
    );

    const control = screen.getByRole("button", {
      name: "Add The Amber Hours to your watchlist",
    });
    expect(control).toHaveAttribute("data-overlay-tone", "light");
  });
});
