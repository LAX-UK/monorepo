import type { LaxLockupKind, LaxLockupScheme } from "./lockup.js";

export type LockupCopy = {
  /** Path from the repo root. */
  path: string;
  kind: LaxLockupKind;
  variant: LaxLockupScheme | "auto";
};

/**
 * Lockups that an app serves from its own files, because a deployed app can only reach files
 * inside its own package. Each is written by `generate:lockups` and checked byte for byte by the
 * lockup tests.
 *
 * Shop and Art serve the light file for structured data and previews (the on-page wordmark is
 * inline). Bid's two full logos are its press-kit downloads and the light and dark `<img>` pair its
 * header swaps.
 */
export const LOCKUP_COPIES: readonly LockupCopy[] = [
  { path: "packages/branding/public/lax-logo.svg", kind: "exchange", variant: "light" },
  { path: "apps/art/public/brand/lax-logo.svg", kind: "exchange", variant: "light" },
  { path: "apps/shop/public/shop/lax-shop-logo.svg", kind: "exchange", variant: "light" },
  { path: "apps/web/public/logo.svg", kind: "bid", variant: "light" },
  { path: "apps/web/public/logo-light.svg", kind: "bid", variant: "dark" },
];
