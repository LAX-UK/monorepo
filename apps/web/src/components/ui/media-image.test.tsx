import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MediaImage } from "./media-image";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

describe("MediaImage", () => {
  it("renders the placeholder for an empty source", () => {
    render(<MediaImage src={null} alt="Artwork" label="Lot artwork" aspect={[4, 5]} />);

    expect(screen.getByLabelText("Lot artwork placeholder")).toBeInTheDocument();
    expect(screen.queryByAltText("Artwork")).not.toBeInTheDocument();
  });

  it("shows a loading placeholder until the image loads", () => {
    render(<MediaImage src="/artwork.jpg" alt="Artwork" label="Lot artwork" aspect={[4, 5]} />);

    expect(screen.getByLabelText("Lot artwork placeholder")).toHaveClass("animate-pulse");
    const image = screen.getByAltText("Artwork");
    expect(image).toHaveClass("opacity-0");

    fireEvent.load(image);

    expect(screen.queryByLabelText("Lot artwork placeholder")).not.toBeInTheDocument();
    expect(image).toHaveClass("opacity-100");
  });

  it("falls back to the placeholder after an image error", () => {
    render(<MediaImage src="/missing.jpg" alt="Missing artwork" label="Lot artwork" />);

    fireEvent.error(screen.getByAltText("Missing artwork"));

    expect(screen.getByLabelText("Lot artwork placeholder")).toBeInTheDocument();
    expect(screen.queryByAltText("Missing artwork")).not.toBeInTheDocument();
  });

  it("supports circular avatar placeholders", () => {
    render(<MediaImage src={null} alt="Avatar" label="MA" shape="circle" className="size-8" />);

    expect(screen.getByLabelText("MA placeholder")).toHaveClass("rounded-full");
  });
});
