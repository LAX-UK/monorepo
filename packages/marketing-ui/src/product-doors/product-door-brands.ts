import {
  LAX_FAMILY_NAMES,
  type LaxLockupKind,
  PRODUCT_ACCENTS,
  PRODUCT_ACCENTS_ON_DARK,
} from "@auction/branding";
import bidIllustration from "@auction/branding/images/product-doors/bid.webp";
import shopIllustration from "@auction/branding/images/product-doors/shop.webp";

/** The LAX products a door can open. LAX Account is reached from the account menu, not a door. */
export type MarketingProductDoorProduct = "bid" | "shop" | "art";

type StaticAsset = string | { src: string };

/** Next resolves an image import to an object; Vite (in tests) resolves it to the URL. */
const urlOf = (asset: StaticAsset): string => (typeof asset === "string" ? asset : asset.src);

export type ProductDoorIllustration = {
  src: string;
  /** Keeps the figures in frame when the art is cropped to the door's aspect. */
  objectPositionClassName: string;
};

export type ProductDoorBrand = {
  name: string;
  lockup: LaxLockupKind;
  /** The product's accent for its lockup tag; `null` keeps the tag on the text colour. */
  accent: { light: string; dark: string } | null;
  /** The product's permanent door art; `null` until one is drawn, so the host supplies an image. */
  illustration: ProductDoorIllustration | null;
};

function accentOf(product: MarketingProductDoorProduct): ProductDoorBrand["accent"] {
  const light = PRODUCT_ACCENTS[product];
  const dark = PRODUCT_ACCENTS_ON_DARK[product];
  return light && dark ? { light, dark } : null;
}

/**
 * How each product presents itself on another product's door: its lockup, its accent and its
 * illustration. The product owns these, so every host shows the same door for it; the host only
 * chooses which doors to show and what they say.
 *
 * Compact lockups keep the three marks at one height. lax.art has no accent (it is the umbrella
 * product) and no illustration yet.
 */
export const PRODUCT_DOOR_BRANDS: Readonly<Record<MarketingProductDoorProduct, ProductDoorBrand>> =
  {
    bid: {
      name: LAX_FAMILY_NAMES.bid,
      lockup: "bid-compact",
      accent: accentOf("bid"),
      illustration: {
        src: urlOf(bidIllustration),
        objectPositionClassName: "object-[50%_25%]",
      },
    },
    shop: {
      name: LAX_FAMILY_NAMES.shop,
      lockup: "shop",
      accent: accentOf("shop"),
      illustration: {
        src: urlOf(shopIllustration),
        objectPositionClassName: "object-[50%_30%]",
      },
    },
    art: {
      name: LAX_FAMILY_NAMES.art,
      lockup: "art",
      accent: accentOf("art"),
      illustration: null,
    },
  };
