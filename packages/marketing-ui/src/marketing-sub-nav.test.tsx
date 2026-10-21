import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingSubNav } from "./marketing-sub-nav.js";
import { SmoothScrollProvider } from "./motion/smooth-scroll/smooth-scroll-context.js";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  targets: Element[];
};

let observers: ObserverRecord[] = [];

class MockIntersectionObserver {
  record: ObserverRecord;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, options, targets: [] };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function fire(
  record: ObserverRecord,
  entries: { target: Element; isIntersecting: boolean; top?: number }[],
) {
  act(() => {
    record.callback(
      entries.map(
        ({ target, isIntersecting, top = 0 }) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: { top } as DOMRectReadOnly,
          }) as IntersectionObserverEntry,
      ),
      {} as IntersectionObserver,
    );
  });
}

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) => ({ matches: reduce && query.includes("reduce") }) as MediaQueryList,
  );
}

function Sections() {
  return (
    <>
      <section id="overview">Overview body</section>
      <section id="installation">Installation body</section>
    </>
  );
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MarketingSubNav link mode", () => {
  it("renders route tabs in a labelled nav with the current page marked", () => {
    render(
      <MarketingSubNav
        ariaLabel="Exhibition dates"
        active="upcoming"
        items={[
          { id: "current", label: "Current", href: "/exhibitions" },
          { id: "upcoming", label: "Upcoming", href: "/exhibitions?status=upcoming" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Exhibition dates" });
    expect(within(nav).getByRole("link", { name: "Upcoming" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Current" })).not.toHaveAttribute("aria-current");
    expect(observers).toHaveLength(0);
  });
});

describe("MarketingSubNav anchor mode", () => {
  it("marks the first section active, then follows the scroll-spy", () => {
    render(
      <>
        <MarketingSubNav
          mode="anchor"
          ariaLabel="Exhibition sections"
          items={[
            { id: "overview", label: "Overview" },
            { id: "installation", label: "Installation views" },
          ]}
        />
        <Sections />
      </>,
    );
    const overview = screen.getByRole("link", { name: "Overview" });
    expect(overview).toHaveAttribute("aria-current", "true");
    expect(overview).toHaveAttribute("href", "#overview");

    const spy = observers.find((o) => o.targets.some((t) => t.id === "installation"));
    expect(spy?.options?.rootMargin).toMatch(/-55%/);
    fire(spy as ObserverRecord, [
      { target: document.getElementById("overview") as Element, isIntersecting: false },
      { target: document.getElementById("installation") as Element, isIntersecting: true },
    ]);
    expect(screen.getByRole("link", { name: "Installation views" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(overview).not.toHaveAttribute("aria-current");
  });

  it("scrolls to the section past the sticky offset, instantly under reduced motion", () => {
    mockReducedMotion(true);
    const scrollTo = vi.fn(() => Promise.resolve());
    render(
      <SmoothScrollProvider value={{ scrollTo }}>
        <MarketingSubNav
          mode="anchor"
          ariaLabel="Exhibition sections"
          items={[
            { id: "overview", label: "Overview" },
            { id: "installation", label: "Installation views" },
          ]}
        />
        <Sections />
      </SmoothScrollProvider>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Installation views" }));
    const target = document.getElementById("installation");
    expect(scrollTo).toHaveBeenCalledWith(target, { offset: -0, immediate: true });
    expect(document.activeElement).toBe(target);
    expect(window.location.hash).toBe("#installation");
    expect(screen.getByRole("link", { name: "Installation views" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("scrolls smoothly when motion is allowed", () => {
    mockReducedMotion(false);
    const scrollTo = vi.fn(() => Promise.resolve());
    render(
      <SmoothScrollProvider value={{ scrollTo }}>
        <MarketingSubNav
          mode="anchor"
          ariaLabel="Sections"
          items={[{ id: "overview", label: "Overview" }]}
        />
        <Sections />
      </SmoothScrollProvider>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Overview" }));
    expect(scrollTo).toHaveBeenCalledWith(document.getElementById("overview"), {
      offset: -0,
      immediate: false,
    });
  });

  it("shows the identity with back-to-top only while stuck", () => {
    mockReducedMotion(false);
    const scrollTo = vi.fn(() => Promise.resolve());
    render(
      <SmoothScrollProvider value={{ scrollTo }}>
        <h1>Fragments of a Familiar World</h1>
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Exhibition sections"
          identity={{ title: "Fragments of a Familiar World", meta: "18 Aug – 27 Aug 2026" }}
          items={[{ id: "overview", label: "Overview" }]}
        />
        <Sections />
      </SmoothScrollProvider>,
    );
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
    const stickyObserver = observers.find((o) => o.targets.every((t) => !t.id));
    fire(stickyObserver as ObserverRecord, [
      {
        target: (stickyObserver as ObserverRecord).targets[0] as Element,
        isIntersecting: false,
        top: -20,
      },
    ]);
    expect(screen.getByText("18 Aug – 27 Aug 2026")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith(0, { immediate: false });
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("renders a hidden reading bar that appears once stuck, with progress and actions", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { container } = render(
      <>
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Reading"
          items={[]}
          identity={{ title: "How to Begin Exploring Art" }}
          progressTargetId="article"
          actions={<span>Share</span>}
        />
        <article id="article">Body</article>
      </>,
    );
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("invisible");

    const article = document.getElementById("article") as HTMLElement;
    vi.spyOn(article, "getBoundingClientRect").mockReturnValue({
      top: -500,
      height: 2000,
    } as DOMRect);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    expect(frames).toHaveLength(1);
    act(() => frames[0]?.(0));

    const stickyObserver = observers.find((o) => o.targets.every((t) => !t.id)) as ObserverRecord;
    fire(stickyObserver, [
      { target: stickyObserver.targets[0] as Element, isIntersecting: false, top: -10 },
    ]);
    expect(nav?.className).not.toContain("invisible");
    expect(screen.getByRole("progressbar", { name: "Reading progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(within(nav as HTMLElement).getByText("Share")).toBeVisible();
    expect(within(nav as HTMLElement).queryAllByRole("link")).toHaveLength(0);
  });
});
