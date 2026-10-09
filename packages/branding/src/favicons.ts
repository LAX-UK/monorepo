/**
 * LAX favicon filenames and URL helpers (vendored from thelax.art /images/f-icons).
 * Binary files live in `packages/branding/public/favicons/` and are copied into each app.
 */

/** Next.js / Shop storefront public path. */
export const LAX_FAVICON_PUBLIC_BASE_PATH = "/favicons" as const;

/** Auth hosted HTML pages serve the same assets under this prefix. */
export const LAX_HOSTED_AUTH_FAVICON_BASE_PATH = "/hosted-auth/favicons" as const;

export const LAX_FAVICON_ASSET_NAMES = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-96x96.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
] as const;

export type LaxFaviconAssetName = (typeof LAX_FAVICON_ASSET_NAMES)[number];

export type LaxFaviconIconLink = {
  url: string;
  sizes?: string;
  type: string;
};

export type LaxFaviconMetadataIcons = {
  icon: LaxFaviconIconLink[];
  apple: string;
};

export function laxFaviconContentType(name: LaxFaviconAssetName): string {
  return name.endsWith(".ico") ? "image/x-icon" : "image/png";
}

export function laxFaviconMetadataIcons(options?: {
  basePath?: string;
  includeIco?: boolean;
}): LaxFaviconMetadataIcons {
  const base = options?.basePath ?? LAX_FAVICON_PUBLIC_BASE_PATH;
  const icon: LaxFaviconIconLink[] = [
    { url: `${base}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
    { url: `${base}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
    { url: `${base}/favicon-96x96.png`, sizes: "96x96", type: "image/png" },
  ];
  if (options?.includeIco !== false) {
    icon.unshift({ url: `${base}/favicon.ico`, type: "image/x-icon" });
  }
  return {
    icon,
    apple: `${base}/apple-touch-icon.png`,
  };
}

/** `<link rel="…">` tags for hosted auth HTML (no external CDN). */
export function laxFaviconLinkTags(basePath: string = LAX_HOSTED_AUTH_FAVICON_BASE_PATH): string {
  const { icon, apple } = laxFaviconMetadataIcons({ basePath, includeIco: true });
  const lines = icon.map((entry) => {
    const sizes = entry.sizes ? ` sizes="${entry.sizes}"` : "";
    return `  <link rel="icon" type="${entry.type}"${sizes} href="${entry.url}">`;
  });
  lines.push(`  <link rel="apple-touch-icon" href="${apple}">`);
  return lines.join("\n");
}
