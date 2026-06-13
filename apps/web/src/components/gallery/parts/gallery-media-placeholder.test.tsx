import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  GALLERY_MEDIA_PLACEHOLDER_LABEL,
  GalleryMediaPlaceholder,
} from "./gallery-media-placeholder";

describe("GalleryMediaPlaceholder", () => {
  it("renders the shared lot gallery label", () => {
    render(<GalleryMediaPlaceholder variant="inline" />);
    expect(screen.getByText(GALLERY_MEDIA_PLACEHOLDER_LABEL)).toBeInTheDocument();
    expect(GALLERY_MEDIA_PLACEHOLDER_LABEL).toBe("Lot artwork");
  });

  it("uses auto tone for inline variant", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="inline" />);
    expect(container.firstElementChild).toHaveClass("dark:bg-surface-container-low");
  });

  it("uses dark tone for lightbox variant", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="lightbox" />);
    expect(container.firstElementChild).toHaveClass("bg-surface-container-low");
    expect(container.firstElementChild).not.toHaveClass("dark:bg-surface-container-low");
  });

  it("applies pulse when loading", () => {
    const { container } = render(<GalleryMediaPlaceholder variant="inline" loading />);
    expect(container.firstElementChild).toHaveClass("animate-pulse");
  });
});
