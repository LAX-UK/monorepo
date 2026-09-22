import type { Metadata } from "next";

/** Commerce, account, and auth flows should not inherit the homepage canonical. */
export const shopPrivatePageMetadata: Metadata = {
  robots: { index: false, follow: false },
};
