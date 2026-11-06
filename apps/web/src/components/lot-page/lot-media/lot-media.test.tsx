import { LotMedia } from "@/components/lot-page/lot-media/lot-media";
import type { GalleryImage } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ src, alt }: { src: string | null; alt: string }) => (
    <img src={src ?? ""} alt={alt} />
  ),
}));
vi.mock("@/components/ui/media-placeholder", () => ({
  MediaPlaceholder: () => <div data-testid="placeholder" />,
}));
vi.mock("@/components/gallery/engine/gallery-lightbox", () => ({
  GalleryLightbox: ({ index }: { index: number }) => <div data-testid="viewer">{index}</div>,
}));
vi.mock("next/dynamic", () => ({
  default: (load: () => Promise<unknown>) => {
    void load;
    return ({ index }: { index: number }) => <div data-testid="viewer">{index}</div>;
  },
}));

const images = (count: number): GalleryImage[] =>
  Array.from({ length: count }, (_, i) => ({ src: `/img/${i}.jpg`, alt: `View ${i + 1}` }));

const layoutOf = (container: HTMLElement) =>
  container.querySelector("[data-media-layout]")?.getAttribute("data-media-layout");

describe("LotMedia", () => {
  it("shows a wall work as today: one picture with an Images strip", () => {
    const { container } = render(<LotMedia title="Harbour" images={images(3)} />);
    expect(layoutOf(container)).toBe("single");
    expect(screen.getByRole("list", { name: "Images" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view larger/i })).toBeInTheDocument();
  });

  it("shows an object with a strip of angles", () => {
    const { container } = render(
      <LotMedia title="Bronze" images={images(3)} displayStyle="object" />,
    );
    expect(layoutOf(container)).toBe("angles");
    expect(screen.getByRole("list", { name: "Angles" })).toBeInTheDocument();
  });

  it("shows a product with angles and zoom", () => {
    const { container } = render(
      <LotMedia title="Watch" images={images(3)} displayStyle="product" />,
    );
    expect(layoutOf(container)).toBe("angles-zoom");
    expect(screen.getByRole("list", { name: "Angles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom in on watch/i })).toBeInTheDocument();
  });

  it("shows the obverse and reverse of a coin side by side", () => {
    const { container } = render(
      <LotMedia title="Sovereign" images={images(2)} displayStyle="product" pairsTwoFaces />,
    );
    expect(layoutOf(container)).toBe("faces");
    expect(screen.getByText("Obverse")).toBeInTheDocument();
    expect(screen.getByText("Reverse")).toBeInTheDocument();
  });

  it("shows a motor car as a swipe gallery with a counter", () => {
    const { container } = render(
      <LotMedia title="Roadster" images={images(5)} displayStyle="showcase" />,
    );
    expect(layoutOf(container)).toBe("swipe");
    expect(screen.getByRole("list", { name: "Roadster, images" })).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("shows a book as a spread of two pages with a Pages strip", () => {
    const { container } = render(
      <LotMedia title="First edition" images={images(4)} displayStyle="document" />,
    );
    expect(layoutOf(container)).toBe("spread");
    expect(screen.getAllByRole("button", { name: /zoom in on page/i })).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Pages" })).toBeInTheDocument();
  });

  it("turns the spread when another page is picked", () => {
    render(<LotMedia title="First edition" images={images(4)} displayStyle="document" />);
    fireEvent.click(screen.getByRole("button", { name: "Page 3 of 4" }));
    expect(screen.getByRole("button", { name: "Zoom in on page 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in on page 4" })).toBeInTheDocument();
  });

  it("opens the viewer at the picture that was zoomed", () => {
    render(<LotMedia title="First edition" images={images(4)} displayStyle="document" />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in on page 2" }));
    expect(screen.getByTestId("viewer")).toHaveTextContent("1");
  });

  it("shows the placeholder for a lot without pictures, in any style", () => {
    render(<LotMedia title="Roadster" images={[]} displayStyle="showcase" />);
    expect(screen.getByTestId("placeholder")).toBeInTheDocument();
  });
});
