import { SaleroomHeroAdaptive } from "@/components/sections/saleroom/saleroom-hero-adaptive";
import { saleroomHeroFixture } from "@/components/sections/saleroom/saleroom-hero.fixture";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("SaleroomHeroAdaptive", () => {
  it("re-exports editorial hero with accessible heading", () => {
    render(<SaleroomHeroAdaptive hero={saleroomHeroFixture} toolbar={null} actions={null} />);
    expect(screen.getByRole("heading", { name: "Modern British Art" })).toBeInTheDocument();
    expect(document.querySelector("[data-overlay-tone]")).toBeNull();
  });
});
