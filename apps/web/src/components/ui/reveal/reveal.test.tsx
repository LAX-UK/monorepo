import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Reveal, RevealInView, RevealOnMount } from "./reveal";
import type { RevealTrigger } from "./triggers";

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

describe("Reveal with injected trigger (DIP)", () => {
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
  it("eventually reveals when IO is unavailable (fallback)", async () => {
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
