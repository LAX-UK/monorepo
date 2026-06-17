import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GalleryHeroOverlays } from "./gallery-overlays";

const mockUseGalleryContext = vi.fn();

vi.mock("@/components/gallery/context/gallery-context", () => ({
  useGalleryContext: () => mockUseGalleryContext(),
}));

vi.mock("@/components/ui/overlay-tone-context", () => ({
  useOverlayTone: () => ({ tone: "light", kind: "frosted" }),
  useOverlayToneContext: () => null,
}));

describe("GalleryHeroOverlays", () => {
  it("renders counter pill but not mobile dot pile when total > 1", () => {
    mockUseGalleryContext.mockReturnValue({
      images: [{ url: "a" }, { url: "b" }, { url: "c" }, { url: "d" }, { url: "e" }],
      index: 0,
    });

    render(<GalleryHeroOverlays />);

    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.getByText("Image 1 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Image position" })).not.toBeInTheDocument();
  });

  it("renders nothing when total <= 1", () => {
    mockUseGalleryContext.mockReturnValue({
      images: [{ url: "a" }],
      index: 0,
    });

    const { container } = render(<GalleryHeroOverlays />);
    expect(container).toBeEmptyDOMElement();
  });
});
