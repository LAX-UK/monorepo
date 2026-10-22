import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingRevealCarousel, type MarketingRevealSlide } from "./marketing-reveal-carousel.js";

// jsdom has no layout, so Embla would report no snap points; a fake engine stands in for it.
const embla = vi.hoisted(() => {
  const handlers = new Map<string, () => void>();
  const state = { selected: 0 };
  const api = {
    scrollSnapList: () => [0, 1],
    selectedScrollSnap: () => state.selected,
    canScrollPrev: () => state.selected > 0,
    canScrollNext: () => state.selected < 1,
    scrollTo: vi.fn((index: number) => {
      state.selected = index;
      handlers.get("select")?.();
    }),
    on: (event: string, handler: () => void) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    internalEngine: () => ({ options: { axis: "x" } }),
  };
  return { api, state };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [() => {}, embla.api],
}));

function slide(key: string, overrides: Partial<MarketingRevealSlide> = {}): MarketingRevealSlide {
  return {
    key,
    eyebrow: ["Featured exhibition", "London"],
    meta: ["16 Apr – 20 Apr 2026"],
    title: `Show ${key}`,
    summary: `About ${key}`,
    cta: { href: `/exhibitions/${key}`, label: "View exhibition" },
    media: <img alt="" src="/x.jpg" />,
    ...overrides,
  };
}

describe("MarketingRevealCarousel", () => {
  it("renders nothing without slides", () => {
    const { container } = render(<MarketingRevealCarousel ariaLabel="Featured" slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one static slide without carousel semantics or dots", () => {
    render(<MarketingRevealCarousel ariaLabel="Featured" slides={[slide("a")]} />);
    expect(screen.getByRole("region", { name: "Featured" })).not.toHaveAttribute(
      "aria-roledescription",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Show a" })).toBeInTheDocument();
    expect(screen.getByText("Featured exhibition")).toBeInTheDocument();
    expect(screen.getByText("16 Apr – 20 Apr 2026")).toBeInTheDocument();
    expect(screen.getByText("About a")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View exhibition" })).toHaveAttribute(
      "href",
      "/exhibitions/a",
    );
    expect(screen.queryByRole("group", { name: "Choose slide" })).not.toBeInTheDocument();
  });

  it("offers button dots and keeps only the active slide interactive", () => {
    render(<MarketingRevealCarousel ariaLabel="Featured" slides={[slide("a"), slide("b")]} />);
    expect(screen.getByRole("region", { name: "Featured" })).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    );
    const dots = screen.getAllByRole("button", { name: /Slide \d of 2/ });
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("aria-pressed", "true");

    const [first, second] = screen.getAllByRole("group", { name: /^\d of 2$/, hidden: true });
    expect(first).not.toHaveAttribute("inert");
    expect(second).toHaveAttribute("inert");

    act(() => {
      fireEvent.click(dots[1] as HTMLElement);
    });
    expect(embla.api.scrollTo).toHaveBeenCalledWith(1);
    expect(dots[1]).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("inert");
    expect(second).not.toHaveAttribute("inert");
  });
});
