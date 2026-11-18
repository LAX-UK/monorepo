import type { GalleryImage } from "@auction/types";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryLightbox } from "./gallery-lightbox";

type LightboxMockProps = {
  render?: unknown;
  slides?: unknown[];
};

const lightboxMock = vi.fn((props: LightboxMockProps) => (
  <div
    data-testid="lightbox-mock"
    data-slides={JSON.stringify(props.slides)}
    data-has-render={String(Boolean(props.render))}
  />
));

vi.mock("yet-another-react-lightbox", () => ({
  default: (props: LightboxMockProps) => lightboxMock(props),
}));

vi.mock("yet-another-react-lightbox/plugins/captions", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/counter", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/fullscreen", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/thumbnails", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/zoom", () => ({ default: () => null }));

vi.mock("@/lib/media/resolve-media-src", () => ({
  resolveMediaSrc: (value: string | null | undefined) =>
    value?.startsWith("uploads/") ? `https://cdn.example.com/${value}` : value,
}));

const images: GalleryImage[] = [
  { src: "uploads/lots/a.jpg", alt: "Lot A" },
  { src: "https://cdn.example.com/b.jpg", alt: "Lot B" },
];

describe("GalleryLightbox", () => {
  beforeEach(() => {
    lightboxMock.mockClear();
  });

  it.each(["iconLoading", "iconError"] as const)(
    "gives the %s placeholder a sized frame to fill (the lightbox's own box has no size)",
    (slot) => {
      render(
        <GalleryLightbox
          images={images}
          index={0}
          open
          onIndexChange={() => {}}
          onClose={() => {}}
        />,
      );
      const props = lightboxMock.mock.calls[0]?.[0] as {
        render: Record<typeof slot, () => React.ReactElement>;
      };
      const { getByTestId } = render(props.render[slot]());

      const frame = getByTestId("lightbox-placeholder-frame");
      expect(frame.className).toContain("relative");
      expect(frame.className).toContain("h-[min(70vh,900px)]");
      expect(frame.className).toContain("w-[min(90vw,900px)]");
      const placeholder = frame.firstElementChild as HTMLElement;
      expect(placeholder.className).toContain("absolute");
      expect(placeholder.className).toContain("inset-0");
    },
  );

  it("passes custom render handlers for loading and error placeholders", () => {
    render(
      <GalleryLightbox
        images={images}
        index={0}
        open
        onIndexChange={() => {}}
        onClose={() => {}}
      />,
    );

    expect(lightboxMock).toHaveBeenCalledTimes(1);
    const props = lightboxMock.mock.calls[0]?.[0] as {
      render?: { iconLoading?: () => unknown; iconError?: () => unknown };
    };
    expect(props.render).toBeDefined();
    expect(typeof props.render?.iconLoading).toBe("function");
    expect(typeof props.render?.iconError).toBe("function");
  });

  it("resolves slide src values through resolveMediaSrc", () => {
    render(
      <GalleryLightbox
        images={images}
        index={0}
        open
        onIndexChange={() => {}}
        onClose={() => {}}
      />,
    );

    const props = lightboxMock.mock.calls[0]?.[0] as { slides: { src: string }[] };
    expect(props.slides[0]?.src).toBe("https://cdn.example.com/uploads/lots/a.jpg");
    expect(props.slides[1]?.src).toBe("https://cdn.example.com/b.jpg");
  });
});
