/** @vitest-environment jsdom */
import { ArtworkGallery } from "@/components/artwork/artwork-gallery.client";
import type { ArtworkGalleryVm } from "@/lib/artwork/artwork-product-page.vm";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const gallery: ArtworkGalleryVm = {
  images: [{ url: "/front.webp", alt: "Warm Basket by Emmett King" }],
  scale: null,
};

describe("ArtworkImageViewer focus", () => {
  afterEach(cleanup);

  it("keeps focus inside the open viewer and returns it to the expand button on close", async () => {
    render(<ArtworkGallery title="Warm Basket" gallery={gallery} />);
    const opener = screen.getByRole("button", { name: "View full screen" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
