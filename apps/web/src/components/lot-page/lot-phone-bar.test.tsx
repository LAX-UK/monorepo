import { LotPhoneBar } from "@/components/lot-page/lot-phone-bar";
import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import type { PhoneBarSummary } from "@/lib/lot-page/phone-bar";
import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});
