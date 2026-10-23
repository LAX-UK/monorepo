import type { LaxLockupScheme } from "./lockup.js";

/**
 * Places that must serve their own copy of the London Art Exchange lockup, because a deployed app
 * or the hosted sign-in server can only reach files inside its own package. Each is written by
 * `generate:lockups` and checked byte for byte by the lockup tests. Paths are from the repo root.
 *
 * Hosted sign-in follows the operating system's colour scheme and shows the file in an `<img>`, so
 * it takes the auto file; the apps serve the light file for structured data and previews.
 */
export const WORDMARK_COPIES: readonly { path: string; variant: LaxLockupScheme | "auto" }[] = [
  { path: "packages/branding/public/lax-logo.svg", variant: "light" },
  { path: "apps/art/public/brand/lax-logo.svg", variant: "light" },
  { path: "apps/shop/public/shop/lax-shop-logo.svg", variant: "light" },
  { path: "packages/auth/src/hosted-auth/assets/lax-shop-logo.svg", variant: "auto" },
];
