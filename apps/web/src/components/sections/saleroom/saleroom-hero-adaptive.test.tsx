import { SaleroomHeroAdaptive } from "@/components/sections/saleroom/saleroom-hero-adaptive";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saleroomHeroFixture } from "./saleroom-hero.fixture";

vi.mock("next/image", () => ({
  default: (props: { alt: string; crossOrigin?: string }) => (
    <img alt={props.alt} data-crossorigin={props.crossOrigin ?? ""} />
  ),
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
  it("mounts adaptive overlay frame when cover image is present", () => {
    const { container } = render(
      <SaleroomHeroAdaptive
        hero={saleroomHeroFixture}
        toolbar={null}
        actions={null}
        isAuthenticated
      />,
    );
    expect(container.querySelector("[data-overlay-resolved]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Modern British Art" })).toBeInTheDocument();
  });

  it("uses overlay tone attributes on hero copy", () => {
    render(<SaleroomHeroAdaptive hero={saleroomHeroFixture} toolbar={null} actions={null} />);
    const heading = screen.getByRole("heading", { name: "Modern British Art" });
    expect(heading).toHaveAttribute("data-overlay-tone");
  });

  it("pluralises live lot count in the status line", () => {
    render(
      <SaleroomHeroAdaptive
        hero={{ ...saleroomHeroFixture, liveLotsCount: 1 }}
        toolbar={null}
        actions={null}
      />,
    );
    expect(screen.getByText(/1 lot live/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 lots live/i)).not.toBeInTheDocument();
  });
});
