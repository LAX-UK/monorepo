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
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    crossOrigin?: string;
  }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} data-crossorigin={crossOrigin ?? ""} />
  ),
}));

beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

describe("MediaImage", () => {
  it("forwards crossOrigin to next/image", () => {
    render(<MediaImage src="/artwork.jpg" alt="Artwork" label="Cover" crossOrigin="anonymous" />);

    expect(screen.getByAltText("Artwork")).toHaveAttribute("data-crossorigin", "anonymous");
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
