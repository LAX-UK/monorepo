import type { Metadata } from "next";

/** Commerce, account, and auth flows should not inherit the homepage canonical. */
const artPrivatePageMetadata: Metadata = {
  robots: { index: false, follow: false },
};

export function artPrivatePageTitle(title: string): Metadata {
  return {
    ...artPrivatePageMetadata,
    title: `${title} | LAX Art`,
  };
}
