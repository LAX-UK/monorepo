/**
 * The LAX Account lockup and the brand typefaces served by the issuer. They are byte-for-byte
 * copies of `packages/branding/public/lockups` and `packages/branding/fonts`;
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
