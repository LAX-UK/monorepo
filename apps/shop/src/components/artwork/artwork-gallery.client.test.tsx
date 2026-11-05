/** @vitest-environment jsdom */
import { ArtworkGallery } from "@/components/artwork/artwork-gallery.client";
import type { ArtworkGalleryVm } from "@/lib/artwork/artwork-product-page.vm";
import { presentArtworkScale } from "@/lib/presenters/artwork-scale.presenter";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // biome-ignore lint/a11y/useAltText: alt is passed through from props
    <img {...props} />
  ),
}));
vi.mock("@auction/ui/components/dialog", async () => (await import("@/test/radix-stubs")).dialog);

const gallery: ArtworkGalleryVm = {
  images: [
    { url: "/front.webp", alt: "Warm Basket by Emmett King" },
    { url: "/detail.webp", alt: "Detail of the paper surface" },
  ],
  scale: presentArtworkScale({ title: "Warm Basket", heightCm: 50, widthCm: 40 }),
};

describe("ArtworkGallery", () => {
  afterEach(cleanup);

  it("offers a thumbnail for the whole, the detail and the scale drawing, moved with the arrow keys", () => {
    render(<ArtworkGallery title="Warm Basket" gallery={gallery} />);
    const first = screen.getByRole("button", { name: "Whole view" });
    expect(first.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "To scale" })).toBeTruthy();

    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("button", { name: "Detail view" });
    expect(second.getAttribute("aria-current")).toBe("true");
    expect(document.activeElement).toBe(second);
    expect(screen.getByAltText("Detail of the paper surface")).toBeTruthy();

    fireEvent.keyDown(second, { key: "End" });
    expect(
      screen.getByRole("img", { name: /drawn to scale on a wall beside a figure 1.7 m tall/ }),
    ).toBeTruthy();
    expect(screen.getByText("50 × 40 cm, drawn to scale beside a 1.7 m figure.")).toBeTruthy();
  });

  it("opens the photograph full screen, with zoom and next and previous", () => {
    render(<ArtworkGallery title="Warm Basket" gallery={gallery} />);
    fireEvent.click(screen.getByRole("button", { name: "View full screen" }));
    const zoom = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoom);
    expect(screen.getByRole("button", { name: "Fit to screen" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText(/Image 1 of 2/)).toBeTruthy();
  });

  it("shows a single photograph without thumbnails or arrows", () => {
    render(
      <ArtworkGallery
        title="Warm Basket"
        gallery={{ images: [{ url: "/front.webp", alt: "Front" }], scale: null }}
      />,
    );
    expect(screen.queryByRole("list", { name: "Choose an image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next image" })).toBeNull();
    expect(screen.getByRole("button", { name: "View full screen" })).toBeTruthy();
  });

  it("leaves out a view without an image", () => {
    render(
      <ArtworkGallery
        title="Warm Basket"
        gallery={{ images: [{ url: "/front.webp", alt: "Front" }], scale: gallery.scale }}
      />,
    );
    expect(screen.getByRole("button", { name: "Whole view" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Detail view" })).toBeNull();
    expect(screen.getByRole("button", { name: "To scale" })).toBeTruthy();
  });

  it("shows the hatch on the mat when there is no image and no size", () => {
    const { container } = render(
      <ArtworkGallery title="Warm Basket" gallery={{ images: [], scale: null }} />,
    );
    expect(container.querySelector(".marketing-work-mat")).not.toBeNull();
    expect(screen.queryByRole("list", { name: "Choose an image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View full screen" })).toBeNull();
  });
});
