// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtworkThumbnail } from "./artwork-thumbnail";
import { StaffCatalogueImageProvider } from "./staff-catalogue-image-provider.client";

const origins = { shop: "https://test-shop.lax.bid", art: "https://test-art.lax.bid" };

function thumbnailSrc(url: string | null): string | null {
  const { container } = render(
    <StaffCatalogueImageProvider origins={origins}>
      <ArtworkThumbnail url={url} />
    </StaffCatalogueImageProvider>,
  );
  return container.querySelector("img")?.getAttribute("src") ?? null;
}

describe("ArtworkThumbnail", () => {
  it("loads a Shop seed image from the Shop storefront", () => {
    expect(thumbnailSrc("/shop/home/artwork-warm-basket.webp")).toBe(
      "https://test-shop.lax.bid/shop/home/artwork-warm-basket.webp",
    );
  });

  it("loads a lax.art seed image from the lax.art storefront", () => {
    expect(thumbnailSrc("/art/seed/artist-juno.webp")).toBe(
      "https://test-art.lax.bid/art/seed/artist-juno.webp",
    );
  });

  it("leaves an uploaded image as it is", () => {
    const url = "https://lax-media.lon1.cdn.digitaloceanspaces.com/artworks/a.webp";
    expect(thumbnailSrc(url)).toBe(url);
  });

  it("shows the placeholder when there is no image", () => {
    expect(thumbnailSrc(null)).toBeNull();
  });
});
