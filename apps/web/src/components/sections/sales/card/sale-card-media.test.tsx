import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} data-testid="next-image" />,
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

describe("SaleCardMedia", () => {
  it("wraps image in a link when linkMode is area", () => {
    render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl="https://example.com/x.jpg"
        coverImageAlt="Lot cover"
        isLive={false}
        linkMode="area"
      />,
    );
    const link = screen.getByRole("link", { name: /view images for lot cover/i });
    expect(link).toHaveAttribute("href", "/sale/1");
  });

  it("does not render a link when linkMode is none", () => {
    render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl={null}
        coverImageAlt="Alt"
        isLive={false}
        linkMode="none"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows live region when isLive and countdownEndIso are set", () => {
    const end = new Date(Date.now() + 60_000).toISOString();
    render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl={null}
        coverImageAlt="Alt"
        isLive
        countdownEndIso={end}
        linkMode="none"
      />,
    );
    expect(screen.getByLabelText(/live auction/i)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
