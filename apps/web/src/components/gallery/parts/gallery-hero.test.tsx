import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GalleryHero, isNeighbour } from "./gallery-hero";

const mockUseGalleryContext = vi.fn();
const mediaImageProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/gallery/context/gallery-context", () => ({
  useGalleryContext: () => mockUseGalleryContext(),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: (props: Record<string, unknown>) => {
    mediaImageProps.push(props);
    return null;
  },
}));

vi.mock("@/components/ui/overlay-tone-context", () => ({
  useOverlayTone: () => ({ tone: "light", kind: "frosted" }),
  useOverlayToneContext: () => null,
}));

vi.mock("@auction/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@auction/ui")>();
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ...original,
    Carousel: Pass,
    CarouselContent: Pass,
    CarouselItem: Pass,
    CarouselNext: () => null,
    CarouselPrevious: () => null,
  };
});

describe("isNeighbour", () => {
  it("is the slide either side of the current one, wrapping round the loop", () => {
    expect([0, 1, 2, 3, 4].filter((slide) => isNeighbour(slide, 0, 5))).toEqual([1, 4]);
    expect([0, 1, 2, 3, 4].filter((slide) => isNeighbour(slide, 2, 5))).toEqual([1, 3]);
    expect([0, 1, 2, 3, 4].filter((slide) => isNeighbour(slide, 4, 5))).toEqual([0, 3]);
  });

  it("has no neighbours with one slide, and two slides are each other's", () => {
    expect(isNeighbour(0, 0, 1)).toBe(false);
    expect(isNeighbour(1, 0, 2)).toBe(true);
  });
});

describe("GalleryHero", () => {
  it("gives priority to the current slide only, and loads the slides either side eagerly", () => {
    mediaImageProps.length = 0;
    mockUseGalleryContext.mockReturnValue({
      images: ["a", "b", "c", "d", "e"].map((src) => ({ src, alt: src })),
      index: 0,
      openLightbox: vi.fn(),
      openViewAll: vi.fn(),
    });

    render(<GalleryHero setCarouselApi={vi.fn()} />);

    const slides = mediaImageProps.filter((props) => typeof props.src === "string");
    const bySrc = (src: string) => slides.find((props) => props.src === src);
    expect(bySrc("a")?.priority).toBe(true);
    for (const src of ["b", "e"]) {
      expect(bySrc(src)?.priority).toBe(false);
      expect(bySrc(src)?.loading).toBe("eager");
    }
    for (const src of ["c", "d"]) {
      expect(bySrc(src)?.priority).toBe(false);
      expect(bySrc(src)?.loading).toBeUndefined();
    }
  });
});
