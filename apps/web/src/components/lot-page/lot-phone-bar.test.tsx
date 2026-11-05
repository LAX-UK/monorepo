import { BidBottomTabBar } from "@/components/layout/bid-bottom-tab-bar";
import { LotPhoneBar } from "@/components/lot-page/lot-phone-bar";
import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import type { PhoneBarSummary } from "@/lib/lot-page/phone-bar";
import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/lot/estuary-at-dawn/abc-123" }));
vi.mock("@/hooks/use-bid-attention", () => ({
  useBidAttention: () => ({ signedIn: false, pending: false, attention: null, chip: null }),
}));

type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit };
let observers: Observed[] = [];

beforeEach(() => {
  observers = [];
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      observers.push({ callback, ...(options ? { options } : {}) });
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SUMMARY: PhoneBarSummary = {
  label: "Current bid",
  labelTone: "neutral",
  amount: "£7,000",
  line: { words: "42 minutes 9 seconds left", compact: "42:09 left", tone: "soon", clock: true },
};

function setup() {
  const target = createRef<HTMLDivElement>();
  render(
    <>
      <div ref={target}>The in-page action</div>
      <CookieDock />
      <LotPhoneBar summary={SUMMARY} target={target}>
        <button type="button">Bid £7,250</button>
      </LotPhoneBar>
    </>,
  );
}

function setVisible(isIntersecting: boolean) {
  act(() => {
    for (const { callback } of observers) {
      callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  });
}

describe("LotPhoneBar", () => {
  it("stays away while the in-page action is in view", () => {
    setup();
    setVisible(true);
    expect(screen.queryByRole("region", { name: "Bidding" })).toBeNull();
  });

  it("appears in the cookie dock once the in-page action scrolls out of view", () => {
    setup();
    setVisible(false);
    const region = screen.getByRole("region", { name: "Bidding" });
    expect(region.closest("[data-cookie-dock-slot]")).not.toBeNull();
    expect(region.textContent).toContain("Current bid");
    expect(region.textContent).toContain("£7,000");
    expect(region.textContent).toContain("42:09 left");
    expect(screen.getByRole("button", { name: "Bid £7,250" })).toBeTruthy();
  });

  it("goes again when the action comes back into view", () => {
    setup();
    setVisible(false);
    setVisible(true);
    expect(screen.queryByRole("region", { name: "Bidding" })).toBeNull();
  });

  it("treats the strip the bar occupies as already covered", () => {
    setup();
    expect(observers[0]?.options?.rootMargin).toBe("0px 0px -88px 0px");
  });

  describe("with the docked tab bar", () => {
    function setupWithTabBar() {
      const target = createRef<HTMLDivElement>();
      render(
        <>
          <div ref={target}>The in-page action</div>
          <CookieDock />
          <BidBottomTabBar />
          <LotPhoneBar summary={SUMMARY} target={target}>
            <button type="button">Bid £7,250</button>
          </LotPhoneBar>
        </>,
      );
    }
    const tabBar = () => screen.getByTestId("bid-bottom-tab-bar");

    it("shows the tab bar, and not the bid bar, while the bid panel is in view", () => {
      setupWithTabBar();
      setVisible(true);
      expect(tabBar()).toHaveAttribute("data-visible", "true");
      expect(screen.queryByRole("region", { name: "Bidding" })).toBeNull();
    });

    it("swaps the tab bar for the bid bar once the panel scrolls away, never both", () => {
      setupWithTabBar();
      setVisible(false);
      expect(screen.getByRole("region", { name: "Bidding" })).toBeTruthy();
      expect(tabBar()).toHaveAttribute("data-visible", "false");
      expect(tabBar()).toHaveAttribute("data-hidden-reason", "slot-claimed");
      expect(tabBar()).toHaveAttribute("inert");
    });

    it("gives the bottom edge back to the tab bar when the panel returns", () => {
      setupWithTabBar();
      setVisible(false);
      setVisible(true);
      expect(screen.queryByRole("region", { name: "Bidding" })).toBeNull();
      expect(tabBar()).toHaveAttribute("data-visible", "true");
      expect(document.documentElement).toHaveAttribute("data-lax-bottom-bar");
    });

    it("lets go of the slot when the bid bar unmounts", () => {
      const target = createRef<HTMLDivElement>();
      const { rerender } = render(
        <>
          <div ref={target}>The in-page action</div>
          <CookieDock />
          <BidBottomTabBar />
          <LotPhoneBar summary={SUMMARY} target={target}>
            <button type="button">Bid</button>
          </LotPhoneBar>
        </>,
      );
      setVisible(false);
      expect(tabBar()).toHaveAttribute("data-visible", "false");
      rerender(
        <>
          <CookieDock />
          <BidBottomTabBar />
        </>,
      );
      expect(tabBar()).toHaveAttribute("data-visible", "true");
    });
  });
});
