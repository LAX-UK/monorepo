import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUpInView } from "./count-up-in-view.js";
import { resetReaderIntentForTests } from "./reveal/reader-intent.js";

// Renders the value it is given and whether it was asked to animate.
vi.mock("@auction/ui", () => ({
  CountUp: ({
    value,
    format,
    disableAnimation,
  }: {
    value: number;
    format?: (n: number) => string;
    disableAnimation?: boolean;
  }) => (
    <span data-testid="count" data-animate={String(!disableAnimation)}>
      {format ? format(value) : String(value)}
    </span>
  ),
}));

const trigger = vi.hoisted(() => ({
  onScreenAtLoad: false,
  fire: null as null | (() => void),
}));

vi.mock("./reveal/triggers.js", () => ({
  inViewTrigger: () => ({
    isSatisfiedOnArm: () => trigger.onScreenAtLoad,
    bind: (_el: Element, onReveal: () => void) => {
      trigger.fire = onReveal;
      return () => {};
    },
  }),
}));

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: reduce && query.includes("reduce"),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

const count = () => screen.getByTestId("count");

describe("CountUpInView", () => {
  beforeEach(() => {
    resetReaderIntentForTests();
    trigger.onScreenAtLoad = false;
    trigger.fire = null;
    window.scrollY = 0;
    mockReducedMotion(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("server render shows the final value", () => {
    const html = renderToString(<CountUpInView value={200} />);
    expect(html).toContain("200");
  });

  it("shows the final value before the reader has moved", () => {
    render(<CountUpInView value={200} />);
    expect(count().textContent).toBe("200");
    expect(count().dataset.animate).toBe("false");
  });

  it("shows the final value under reduced motion, even after scrolling", () => {
    mockReducedMotion(true);
    render(<CountUpInView value={42} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(trigger.fire).toBeNull();
    expect(count().textContent).toBe("42");
    expect(count().dataset.animate).toBe("false");
  });

  it("shows the final value for a counter already on screen at load", () => {
    trigger.onScreenAtLoad = true;
    render(<CountUpInView value={200} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(count().textContent).toBe("200");
    expect(count().dataset.animate).toBe("false");
  });

  it("leaves a counter that came into view before any scroll as drawn", () => {
    render(<CountUpInView value={200} />);
    act(() => trigger.fire?.());
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(count().textContent).toBe("200");
    expect(count().dataset.animate).toBe("false");
  });

  it("starts from zero after the reader scrolls, then animates when it enters the viewport", () => {
    render(<CountUpInView value={200} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(count().textContent).toBe("0");
    act(() => trigger.fire?.());
    expect(count().textContent).toBe("200");
    expect(count().dataset.animate).toBe("true");
  });

  it("does not arm on typing", () => {
    render(<CountUpInView value={200} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(count().textContent).toBe("200");
  });

  it("shows the final value when printing", () => {
    render(<CountUpInView value={200} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(count().textContent).toBe("0");
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(count().textContent).toBe("200");
    expect(count().dataset.animate).toBe("false");
  });
});
