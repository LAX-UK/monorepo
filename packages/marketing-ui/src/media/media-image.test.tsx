import { ImageSrcResolverProvider } from "@auction/ui/lib/image-src-context";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MediaImage } from "./media-image.js";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    crossOrigin,
    unoptimized,
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    crossOrigin?: string;
    unoptimized?: boolean;
  }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img
      {...props}
      data-crossorigin={crossOrigin ?? ""}
      data-unoptimized={String(Boolean(unoptimized))}
    />
  ),
}));

beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

describe("MediaImage", () => {
  it("shows initials, not a label, on the placeholder of an artist without a portrait", () => {
    render(
      <MediaImage src={null} alt="Portrait of Ada Cole" label="Artist portrait" monogram="AC" />,
    );

    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(screen.queryByText("Artist portrait")).not.toBeInTheDocument();
  });

  it("forwards crossOrigin to next/image", () => {
    render(<MediaImage src="/artwork.jpg" alt="Artwork" label="Cover" crossOrigin="anonymous" />);

    expect(screen.getByAltText("Artwork")).toHaveAttribute("data-crossorigin", "anonymous");
  });

  it("asks for the largest image first only when it is the priority image", () => {
    render(
      <>
        <MediaImage src="/first.jpg" alt="First" label="Cover" priority />
        <MediaImage src="/second.jpg" alt="Second" label="Cover" />
      </>,
    );

    expect(screen.getByAltText("First")).toHaveAttribute("fetchpriority", "high");
    expect(screen.getByAltText("Second")).not.toHaveAttribute("fetchpriority");
  });

  it("loads a picture eagerly, without the priority hint, when asked to", () => {
    render(<MediaImage src="/near.jpg" alt="Near" label="Cover" loading="eager" />);

    expect(screen.getByAltText("Near")).toHaveAttribute("loading", "eager");
    expect(screen.getByAltText("Near")).not.toHaveAttribute("fetchpriority");
  });

  it("applies resolveSrc before rendering", () => {
    render(
      <MediaImage
        src="raw.jpg"
        alt="Artwork"
        label="Cover"
        resolveSrc={(value) => (value ? `/cdn/${value}` : null)}
      />,
    );

    expect(screen.getByAltText("Artwork")).toHaveAttribute("src", "/cdn/raw.jpg");
  });

  it("applies the host resolver and loads a rewritten source unoptimised", () => {
    render(
      <ImageSrcResolverProvider resolve={(value) => (value ? `https://shop.test${value}` : null)}>
        <MediaImage src="/shop/a.webp" alt="Artwork" label="Cover" />
      </ImageSrcResolverProvider>,
    );

    const image = screen.getByAltText("Artwork");
    expect(image).toHaveAttribute("src", "https://shop.test/shop/a.webp");
    expect(image).toHaveAttribute("data-unoptimized", "true");
  });

  it("optimises a source the host resolver leaves alone", () => {
    render(<MediaImage src="/art/a.webp" alt="Artwork" label="Cover" />);

    expect(screen.getByAltText("Artwork")).toHaveAttribute("data-unoptimized", "false");
  });

  it("shows placeholder for empty source", () => {
    render(<MediaImage src={null} alt="Artwork" label="Lot artwork" />);

    expect(screen.getByLabelText("Lot artwork placeholder")).toBeInTheDocument();
    expect(screen.queryByAltText("Artwork")).not.toBeInTheDocument();
  });

  it("hides loading placeholder after load", async () => {
    render(<MediaImage src="/artwork.jpg" alt="Artwork" label="Lot artwork" aspect={[4, 5]} />);

    fireEvent.load(screen.getByAltText("Artwork"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Lot artwork placeholder")).not.toBeInTheDocument();
    });
  });
});
