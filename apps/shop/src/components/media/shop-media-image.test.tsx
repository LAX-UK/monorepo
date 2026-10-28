/** @vitest-environment jsdom */
import { CatalogueImageProvider } from "@auction/shop-portal/react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopMediaImage as ClientShopMediaImage } from "./shop-media-image";
import { ShopMediaImage as ServerShopMediaImage } from "./shop-media-image.server";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    unoptimized,
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    unoptimized?: boolean;
  }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} data-unoptimized={String(Boolean(unoptimized))} />
  ),
}));

const origins = { shop: "https://test-shop.lax.bid", art: "https://test-art.lax.bid" };
const SHOP_SEED = "/shop/home/artwork-warm-basket.webp";
const ART_SEED = "/art/seed/artist-juno.webp";
const CDN = "https://lax-media.lon1.cdn.digitaloceanspaces.com/artworks/a.webp";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Shop catalogue images", () => {
  it.each([
    ["Shop seed", SHOP_SEED, SHOP_SEED],
    ["lax.art artist portrait copy", ART_SEED, ART_SEED],
    ["uploaded image", CDN, CDN],
  ])("keeps the %s as it is in client images", (_name, src, expected) => {
    render(
      <CatalogueImageProvider viewer="shop" origins={origins}>
        <ClientShopMediaImage src={src} alt="Work" />
      </CatalogueImageProvider>,
    );
    const image = screen.getByAltText("Work");
    expect(image).toHaveAttribute("src", expected);
    expect(image).toHaveAttribute("data-unoptimized", "false");
  });

  it("keeps a Shop seed image relative in server images", () => {
    vi.stubEnv("SHOP_STOREFRONT_URL", origins.shop);
    vi.stubEnv("LAX_ART_PUBLIC_URL", origins.art);
    render(<ServerShopMediaImage src={SHOP_SEED} alt="Work" />);
    const image = screen.getByAltText("Work");
    expect(image).toHaveAttribute("src", SHOP_SEED);
    expect(image).toHaveAttribute("data-unoptimized", "false");
  });
});
