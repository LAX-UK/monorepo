import { DayMediaThumbnail } from "@/components/sections/saleroom/day-gallery/day-media-thumbnail";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt, className }: { alt?: string; className?: string }) => (
    <div data-testid="media-box" className={className}>
      <img alt={alt ?? ""} />
    </div>
  ),
}));

const PHOTO = { mediaType: "image" as const, src: "uploads/day-1.jpg", alt: "Photo 1" };

/**
 * The auction-day photo uses the kit's card hover (packages/ui/src/lax/hover-press.css, MO9):
 * its box zooms to 1.02 over the media token for a mouse only, so the image inside keeps its own
 * load fade. The behaviour itself is proved in Chromium by hover-press-resolved.test.ts.
 */
describe("DayMediaThumbnail hover", () => {
  it("an inline photo is a kit card whose picture box zooms; nothing is hand-written", () => {
    render(
      <DayMediaThumbnail
        item={PHOTO}
        index={0}
        total={3}
        saleTitle="Evening Sale"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Open photo 1 of 3/ })).toHaveClass("lax-card");
    const box = screen.getByTestId("media-box");
    expect(box).toHaveClass("lax-card-zoom");
    expect(box.className).not.toMatch(/scale-\[|duration-500|transition-transform/);
  });

  it("a photo in the view-all sheet does not zoom", () => {
    render(
      <DayMediaThumbnail
        item={PHOTO}
        index={0}
        total={3}
        saleTitle="Evening Sale"
        variant="sheet"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("media-box")).not.toHaveClass("lax-card-zoom");
  });
});
