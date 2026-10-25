import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  GALLERY_MEDIA_PLACEHOLDER_LABEL,
  GalleryMediaPlaceholder,
} from "./gallery-media-placeholder";

describe("GalleryMediaPlaceholder", () => {
  it("names the missing lot artwork for assistive tech without printing it on the mat", () => {
    render(<GalleryMediaPlaceholder variant="inline" />);
    expect(screen.getByRole("img", { name: "Lot artwork placeholder" })).toBeInTheDocument();
    expect(screen.queryByText(GALLERY_MEDIA_PLACEHOLDER_LABEL)).not.toBeInTheDocument();
    expect(GALLERY_MEDIA_PLACEHOLDER_LABEL).toBe("Lot artwork");
  });

  it("sits on the product's paper mat inline", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="inline" />);
    expect(container.firstElementChild).toHaveClass("bg-surface-container-low");
  });

  it("stays dark in the lightbox", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="lightbox" />);
    expect(container.firstElementChild).toHaveClass("bg-neutral-900");
    expect(container.firstElementChild).not.toHaveClass("bg-surface-container-low");
  });

  it("applies pulse when loading", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="inline" loading />);
    expect(container.firstElementChild).toHaveClass("animate-pulse");
  });
});
