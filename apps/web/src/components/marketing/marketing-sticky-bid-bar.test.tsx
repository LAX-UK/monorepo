import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { MarketingBottomTabBar } from "@auction/marketing-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

describe("MarketingStickyBidBar", () => {
  it("holds the shared bottom slot, so the docked tab bar is never stacked under it", () => {
    const { unmount } = render(
      <>
        <CookieDock />
        <MarketingBottomTabBar
          tabs={[{ key: "home", label: "Home", icon: null, href: "/", paths: ["/"] }]}
          pathname="/sales/spring"
          onSearch={() => {}}
        />
        <MarketingStickyBidBar>
          <button type="button">Register to bid</button>
        </MarketingStickyBidBar>
      </>,
    );
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(nav).toHaveAttribute("data-hidden-reason", "slot-claimed");
    expect(screen.getByRole("region", { name: "Sale" })).toBeInTheDocument();
    unmount();
  });
});
