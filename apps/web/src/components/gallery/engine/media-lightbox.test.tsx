import type { SaleDayMedia } from "@auction/types";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLightbox } from "./media-lightbox";

type LightboxMockProps = {
  slides?: unknown[];
  video?: unknown;
};

const lightboxMock = vi.fn((props: LightboxMockProps) => (
  <div data-testid="media-lightbox-mock" data-slides={JSON.stringify(props.slides)} />
));

vi.mock("yet-another-react-lightbox", () => ({
  default: (props: LightboxMockProps) => lightboxMock(props),
}));

vi.mock("yet-another-react-lightbox/plugins/captions", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/counter", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/fullscreen", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/thumbnails", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/video", () => ({ default: () => null }));
vi.mock("yet-another-react-lightbox/plugins/zoom", () => ({ default: () => null }));

vi.mock("@/lib/media/resolve-media-src", () => ({
  resolveMediaSrc: (value: string | null | undefined) =>
    value?.startsWith("uploads/") ? `https://cdn.example.com/${value}` : value,
}));

const items: SaleDayMedia[] = [
  { mediaType: "image", src: "uploads/sales/day-1.jpg", alt: "Photo 1", caption: "On the block" },
  {
    mediaType: "video",
    src: "uploads/sales/clip.webm",
    posterSrc: "uploads/sales/poster.jpg",
    caption: "Hammer down",
  },
];

describe("MediaLightbox", () => {
  beforeEach(() => {
    lightboxMock.mockClear();
  });

  it("builds image and video slides with resolved media src values", () => {
    render(
      <MediaLightbox items={items} index={0} open onIndexChange={() => {}} onClose={() => {}} />,
    );

    expect(lightboxMock).toHaveBeenCalledTimes(1);
    const props = lightboxMock.mock.calls[0]?.[0] as {
      slides: Array<
        | { src: string; description?: string }
        | { type: "video"; sources: { src: string; type: string }[]; poster?: string }
      >;
    };

    expect(props.slides[0]).toMatchObject({
      src: "https://cdn.example.com/uploads/sales/day-1.jpg",
      description: "On the block",
    });
    expect(props.slides[1]).toMatchObject({
      type: "video",
      sources: [{ src: "https://cdn.example.com/uploads/sales/clip.webm", type: "video/webm" }],
      poster: "https://cdn.example.com/uploads/sales/poster.jpg",
      description: "Hammer down",
    });
  });
});
