import type { AccountProductId } from "@/server/domain/account-products.vm";
import artDark from "@auction/branding/lockups/lax-art-dark.svg";
import artLight from "@auction/branding/lockups/lax-art.svg";
import bidDark from "@auction/branding/lockups/lax-bid-compact-dark.svg";
import bidLight from "@auction/branding/lockups/lax-bid-compact.svg";
import shopDark from "@auction/branding/lockups/lax-shop-dark.svg";
import shopLight from "@auction/branding/lockups/lax-shop.svg";

type StaticAsset = string | { src: string };

/** Next resolves an SVG import to an image object; Vite (in tests) resolves it to a URL. */
const urlOf = (asset: StaticAsset): string => (typeof asset === "string" ? asset : asset.src);

/**
 * The shared lockups, which carry each product's own accent: light for light surfaces and dark
 * for dark. Bid uses the compact lockup (no tagline) so all three marks render at one height.
 */
export const PRODUCT_LOCKUPS: Readonly<Record<AccountProductId, { light: string; dark: string }>> =
  {
    bid: { light: urlOf(bidLight), dark: urlOf(bidDark) },
    shop: { light: urlOf(shopLight), dark: urlOf(shopDark) },
    art: { light: urlOf(artLight), dark: urlOf(artDark) },
  };
