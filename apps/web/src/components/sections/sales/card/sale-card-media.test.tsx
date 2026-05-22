import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: {
    alt: string;
    crossOrigin?: string;
    "data-testid"?: string;
  }) => <img alt={props.alt} data-testid="next-image" data-crossorigin={props.crossOrigin ?? ""} />,
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
    expect(screen.getByAltText("Lot cover")).toBeInTheDocument();
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

  it("calendarRow list layout uses a single sized root with aspect ratio", () => {
    const { container } = render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl="https://example.com/x.jpg"
        coverImageAlt="Cover"
        isLive={false}
        layout="calendarRow"
        className="max-h-[11rem]"
        linkMode="area"
      />,
    );
    const roots = container.querySelectorAll(".group\\/image");
    expect(roots.length).toBe(1);
    expect(roots[0]).toHaveClass("aspect-[16/10]");
    expect(roots[0]).toHaveClass("shrink-0");
    expect(roots[0]).toHaveClass("max-h-[11rem]");
    expect(container.querySelector("[data-overlay-resolved]")).toBeNull();
  });

  it("non-live path does not use adaptive frame or crossOrigin", () => {
    const { container } = render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl="https://example.com/x.jpg"
        coverImageAlt="Scheduled sale"
        isLive={false}
        linkMode="area"
      />,
    );
    expect(container.querySelector("[data-overlay-resolved]")).toBeNull();
    const img = screen.getByTestId("next-image");
    expect(img).toHaveAttribute("data-crossorigin", "");
  });

  it("shows live region when isLive and countdownEndIso are set", () => {
    const end = new Date(Date.now() + 60_000).toISOString();
    const { container } = render(
      <SaleCardMedia
        href="/sale/1"
        coverImageUrl="https://example.com/x.jpg"
        coverImageAlt="Live sale"
        isLive
        countdownEndIso={end}
        linkMode="area"
      />,
    );
    expect(screen.getByLabelText(/live auction/i)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(container.querySelector("[data-overlay-resolved]")).toBeInTheDocument();
    expect(screen.getByTestId("next-image")).toHaveAttribute("data-crossorigin", "anonymous");
  });
});
