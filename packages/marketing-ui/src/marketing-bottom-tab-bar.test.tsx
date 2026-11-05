import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimBottomSlot } from "./bottom-bar/bottom-slot.js";
import type { MarketingBottomTab } from "./bottom-bar/bottom-tab-config.js";
import { MarketingBottomBarSpace, MarketingBottomTabBar } from "./marketing-bottom-tab-bar.js";

const icon = <svg data-testid="icon" />;

function shopTabs(basketCount = 0, accountDot = false): MarketingBottomTab[] {
  return [
    { key: "home", label: "Home", icon, href: "/", paths: ["/"] },
    { key: "shop", label: "Shop", icon, href: "/artworks", paths: ["/artworks"] },
    { key: "search", label: "Search", icon, action: "search", paths: [] },
    {
      key: "basket",
      label: "Basket",
      icon,
      href: "/basket",
      paths: ["/basket"],
      badge: basketCount > 0 ? { kind: "count", count: basketCount } : null,
    },
    {
      key: "account",
      label: "Account",
      icon,
      href: "/account",
      paths: ["/account"],
      badge: accountDot ? { kind: "dot" } : null,
    },
  ];
}

function bar(overrides: Partial<React.ComponentProps<typeof MarketingBottomTabBar>> = {}) {
  return (
    <MarketingBottomTabBar
      tabs={shopTabs()}
      pathname="/artworks/blue"
      onSearch={() => {}}
      {...overrides}
    />
  );
}

function fakeViewport(height: number) {
  const target = new EventTarget() as EventTarget & { height: number };
  target.height = height;
  Object.defineProperty(window, "visualViewport", { configurable: true, value: target });
  return {
    resize(next: number) {
      target.height = next;
      target.dispatchEvent(new Event("resize"));
    },
  };
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-lax-bottom-bar");
});

describe("MarketingBottomTabBar full-page tabs", () => {
  it("renders a plain anchor, with no client navigation, for a tab that starts a sign-in", () => {
    const tabs: MarketingBottomTab[] = [
      { key: "home", label: "Home", icon, href: "/", paths: ["/"] },
      {
        key: "account",
        label: "Account",
        icon,
        href: "/login?returnTo=%2Faccount",
        paths: ["/account"],
        fullPageNavigation: true,
      },
    ];
    render(<MarketingBottomTabBar tabs={tabs} pathname="/" onSearch={() => {}} />);
    const account = screen.getByRole("link", { name: "Account" });
    expect(account).toHaveAttribute("href", "/login?returnTo=%2Faccount");
    expect(account.tagName).toBe("A");
    expect(account).not.toHaveAttribute("data-prefetch");
  });
});

describe("MarketingBottomTabBar", () => {
  it("is a Shortcuts navigation of links, not ARIA tabs", () => {
    render(bar());
    const nav = screen.getByRole("navigation", { name: "Shortcuts" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("marks only the matching tab as the current page, with an accent indicator", () => {
    render(bar({ accent: "#5a2a5c" }));
    const current = screen.getByRole("link", { name: "Shop" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("after:h-0.5");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("navigation").style.getPropertyValue("--lax-tab-accent")).toBe(
      "#5a2a5c",
    );
  });

  it("makes Search a button that calls the search handler", () => {
    const onSearch = vi.fn();
    render(bar({ onSearch }));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
  });

  it("is 56px per row, with the safe area, shown below 768px only", () => {
    render(bar());
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("md:hidden");
    expect(nav.className).toContain("env(safe-area-inset-bottom");
    expect(screen.getByRole("link", { name: "Home" }).className).toContain("h-14");
    expect(screen.getByRole("link", { name: "Home" }).className).toContain("text-[11px]");
  });

  it("shows a count badge on the Basket, capped at 9+", () => {
    const { rerender } = render(bar({ tabs: shopTabs(3) }));
    expect(screen.getByTestId("tab-badge-Basket")).toHaveTextContent("3");
    rerender(bar({ tabs: shopTabs(12) }));
    expect(screen.getByTestId("tab-badge-Basket")).toHaveTextContent("9+");
    rerender(bar({ tabs: shopTabs(0) }));
    expect(screen.queryByTestId("tab-badge-Basket")).toBeNull();
  });

  it("shows a dot on Account when attention is needed, and says so", () => {
    render(bar({ tabs: shopTabs(0, true) }));
    expect(screen.getByTestId("tab-badge-Account").textContent).toBe("");
    expect(screen.getByRole("link", { name: "Account, needs attention" })).toBeInTheDocument();
  });

  it("fades in 150ms and not at all under reduced motion", () => {
    render(bar());
    const cls = screen.getByRole("navigation").className;
    expect(cls).toContain("duration-150");
    expect(cls).toContain("motion-reduce:transition-none");
  });

  describe("hidden states", () => {
    it("is visible and not inert by default", () => {
      render(bar());
      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("data-visible", "true");
      expect(nav).not.toHaveAttribute("inert");
    });

    it("hides while the keyboard is open (viewport shrunk and a field focused)", () => {
      const viewport = fakeViewport(800);
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
      render(
        <>
          <input aria-label="Email" />
          {bar()}
        </>,
      );
      const nav = screen.getByRole("navigation", { hidden: true });
      screen.getByLabelText("Email").focus();
      act(() => viewport.resize(400));
      expect(nav).toHaveAttribute("data-visible", "false");
      expect(nav).toHaveAttribute("data-hidden-reason", "keyboard");
      expect(nav).toHaveAttribute("inert");
      act(() => viewport.resize(800));
      expect(nav).toHaveAttribute("data-visible", "true");
    });

    it("stays visible when the viewport shrinks with no field focused", () => {
      const viewport = fakeViewport(800);
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
      render(bar());
      act(() => viewport.resize(400));
      expect(screen.getByRole("navigation")).toHaveAttribute("data-visible", "true");
    });

    it("hides and goes inert while a modal is open", async () => {
      render(bar());
      const nav = screen.getByRole("navigation");
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-state", "open");
      await act(async () => {
        document.body.appendChild(dialog);
        await Promise.resolve();
      });
      expect(nav).toHaveAttribute("data-hidden-reason", "modal");
      expect(nav).toHaveAttribute("inert");
      await act(async () => {
        dialog.remove();
        await Promise.resolve();
      });
      expect(nav).toHaveAttribute("data-visible", "true");
    });

    it("hides while another bar claims the shared bottom slot", () => {
      render(bar());
      const nav = screen.getByRole("navigation");
      let release = () => {};
      act(() => {
        release = claimBottomSlot("bid-bar");
      });
      expect(nav).toHaveAttribute("data-hidden-reason", "slot-claimed");
      expect(nav).toHaveAttribute("inert");
      act(() => release());
      expect(nav).toHaveAttribute("data-visible", "true");
    });

    it("hides when told to from outside", () => {
      render(bar({ hidden: true }));
      expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("inert");
    });

    it("never hides on scroll", () => {
      render(bar());
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(screen.getByRole("navigation")).toHaveAttribute("data-visible", "true");
    });
  });

  it("marks the page so the bottom space is reserved once, and clears it on unmount", () => {
    const { unmount } = render(bar());
    expect(document.documentElement).toHaveAttribute("data-lax-bottom-bar");
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-lax-bottom-bar");
  });
});

describe("MarketingBottomBarSpace", () => {
  it("reserves the --lax-bottom-bar-space variable", () => {
    render(<MarketingBottomBarSpace />);
    expect(screen.getByTestId("bottom-bar-space").className).toContain("--lax-bottom-bar-space");
  });
});
