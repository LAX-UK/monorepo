import type { HostedNamedProduct } from "./brand.js";

/**
 * The LAX Account and product lockups, the sign-in painting and the brand typefaces served by the
 * issuer. They are byte-for-byte copies of `packages/branding/public` and `packages/branding/fonts`;
 * `packages/branding/tests/hosted-auth-assets.test.ts` fails when they drift. This package
 * may not import `@auction/branding`, so the files are vendored rather than referenced.
 */
export type HostedLockupVariant = "light" | "dark";

export const HOSTED_LOCKUP_ASSET_DIR = "lockups";
export const HOSTED_LOCKUP_BASE_PATH = "/hosted-auth/lockups";

/** viewBox width / height of the Account lockup, so the image reserves its space before it loads. */
const ACCOUNT_LOCKUP_ASPECT = 1015.5 / 287.96;

export function hostedLockupWidth(height: number): number {
  return Math.round(height * ACCOUNT_LOCKUP_ASPECT);
}

export function hostedLockupFilename(variant: HostedLockupVariant): string {
  return variant === "dark" ? "lax-account-dark.svg" : "lax-account.svg";
}

export function hostedLockupPath(variant: HostedLockupVariant): string {
  return `${HOSTED_LOCKUP_BASE_PATH}/${hostedLockupFilename(variant)}`;
}

type ProductLockup = { light: string; dark: string; aspect: number };

/**
 * The products one account opens, as their own lockups (each keeps its accent). Bid uses its
 * compact lockup so all three marks sit at one height, as on LAX Account.
 */
export const HOSTED_PRODUCT_LOCKUPS: Readonly<Record<HostedNamedProduct, ProductLockup>> = {
  bid: { light: "lax-bid-compact.svg", dark: "lax-bid-compact-dark.svg", aspect: 765 / 281.06 },
  shop: { light: "lax-shop.svg", dark: "lax-shop-dark.svg", aspect: 839.4 / 281.06 },
  art: { light: "lax-art.svg", dark: "lax-art-dark.svg", aspect: 780.68 / 281.06 },
};

/** Every lockup file the issuer serves. */
export const HOSTED_LOCKUP_FILES: readonly string[] = [
  hostedLockupFilename("light"),
  hostedLockupFilename("dark"),
  ...Object.values(HOSTED_PRODUCT_LOCKUPS).flatMap((lockup) => [lockup.light, lockup.dark]),
];

export const HOSTED_IMAGE_ASSET_DIR = "images";
export const HOSTED_IMAGE_BASE_PATH = "/hosted-auth/images";
/** The gallery painting beside the sign-in panel, the same one LAX Account shows. */
export const HOSTED_GALLERY_IMAGE = "signin-gallery.webp";

/** Variable-weight Latin subsets of the two brand typefaces. */
export const HOSTED_FONT_FILES = {
  montserrat: "montserrat-latin-wght-normal.woff2",
  outfit: "outfit-latin-wght-normal.woff2",
} as const;

export type HostedFontFile = (typeof HOSTED_FONT_FILES)[keyof typeof HOSTED_FONT_FILES];

export const HOSTED_FONT_ASSET_DIR = "fonts";
export const HOSTED_FONT_BASE_PATH = "/hosted-auth/fonts";

export function hostedFontPath(file: HostedFontFile): string {
  return `${HOSTED_FONT_BASE_PATH}/${file}`;
}
