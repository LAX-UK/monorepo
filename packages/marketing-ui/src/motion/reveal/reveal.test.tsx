import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal, RevealInView, RevealOnMount, RevealStagger } from "./reveal.js";
import type { RevealTrigger } from "./triggers.js";

describe("RevealOnMount", () => {
  it("sets data-revealed after mount", async () => {
    const { container } = render(
      <RevealOnMount>
        <span>content</span>
      </RevealOnMount>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector("[data-revealed='true']")).not.toBeNull();
    });
  });
});

describe("Reveal with injected trigger", () => {
  it("reveals when the trigger invokes onReveal", async () => {
    const onRevealRef: { current: (() => void) | null } = { current: null };
    const fakeTrigger: RevealTrigger = {
      id: "fake",
      bind(_el, onReveal) {
        onRevealRef.current = onReveal;
        return () => {};
      },
    };

    const { container } = render(
      <Reveal trigger={fakeTrigger}>
        <span>inner</span>
      </Reveal>,
    );

    expect(container.querySelector("[data-revealed='true']")).toBeNull();
    await waitFor(() => {
      expect(onRevealRef.current).not.toBeNull();
    });
    onRevealRef.current?.();
    await waitFor(() => {
      expect(container.querySelector("[data-revealed='true']")).not.toBeNull();
    });
  });
});

describe("RevealInView", () => {
  it("reveals when IntersectionObserver is unavailable", async () => {
    const originalIO = globalThis.IntersectionObserver;
    // @ts-expect-error test shim
    globalThis.IntersectionObserver = undefined;

    const { container } = render(
      <RevealInView>
        <span>grid</span>
      </RevealInView>,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-revealed='true']")).not.toBeNull();
    });

    globalThis.IntersectionObserver = originalIO;
  });
});

describe("RevealStagger", () => {
  it("applies incremental delay via style", async () => {
    const { container } = render(
      <RevealStagger stepMs={80} maxDelayMs={160}>
        <span>a</span>
        <span>b</span>
      </RevealStagger>,
    );
    const reveals = container.querySelectorAll(".reveal");
    expect(reveals.length).toBe(2);
    expect((reveals[0] as HTMLElement).style.getPropertyValue("--reveal-delay")).toBe("0ms");
    expect((reveals[1] as HTMLElement).style.getPropertyValue("--reveal-delay")).toBe("80ms");
  });

  it("caps delay at maxDelayMs", () => {
    const { container } = render(
      <RevealStagger stepMs={80} maxDelayMs={160}>
        <span>a</span>
        <span>b</span>
        <span>c</span>
        <span>d</span>
      </RevealStagger>,
    );
    const reveals = container.querySelectorAll(".reveal");
    expect((reveals[3] as HTMLElement).style.getPropertyValue("--reveal-delay")).toBe("160ms");
  });
});

describe("server render", () => {
  it("does not hide content before JavaScript arms the reveal", () => {
    const html = renderToString(
      <RevealInView variant="rise">
        <span>crawlable</span>
      </RevealInView>,
    );
    expect(html).toContain("crawlable");
    expect(html).not.toContain("data-reveal-init");
  });
});

describe("above-the-fold content", () => {
  it("keeps the server paint when the trigger is satisfied on arm", async () => {
    const bind = vi.fn(() => () => {});
    const trigger: RevealTrigger = { id: "visible", bind, isSatisfiedOnArm: () => true };
    const { container } = render(
      <Reveal trigger={trigger} variant="rise">
        <span>hero-adjacent</span>
      </Reveal>,
    );
    const el = container.querySelector(".reveal");
    expect(el?.hasAttribute("data-reveal-init")).toBe(false);
    expect(el?.hasAttribute("data-revealed")).toBe(false);
    expect(bind).not.toHaveBeenCalled();
  });
});

describe("below-the-fold content", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays unrevealed until the element intersects", () => {
    vi.useFakeTimers();
    const fakeTrigger: RevealTrigger = { id: "never", bind: () => () => {} };
    const { container } = render(
      <Reveal trigger={fakeTrigger}>
        <span>below fold</span>
      </Reveal>,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelector("[data-revealed='true']")).toBeNull();
  });
});

describe("rise variant", () => {
  it("uses reveal--rise modifier class", () => {
    const { container } = render(
      <RevealOnMount variant="rise">
        <span>rise</span>
      </RevealOnMount>,
    );
    expect(container.querySelector(".reveal--rise")).not.toBeNull();
  });
});
