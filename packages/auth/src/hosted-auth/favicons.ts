/**
 * Hosted auth favicon metadata (self-hosted under /hosted-auth/favicons).
 * Asset bytes match `packages/branding/public/favicons` — sync via scripts/vendor/lax-favicons.mjs.
 */

export const HOSTED_AUTH_FAVICON_BASE_PATH = "/hosted-auth/favicons" as const;

export const HOSTED_FAVICON_ASSET_NAMES = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-96x96.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
] as const;

export type HostedFaviconAssetName = (typeof HOSTED_FAVICON_ASSET_NAMES)[number];

export function hostedFaviconContentType(name: HostedFaviconAssetName): string {
  return name.endsWith(".ico") ? "image/x-icon" : "image/png";
}

/** `<link rel="…">` tags for hosted auth HTML (no external CDN). */
export function hostedFaviconLinkTags(basePath: string = HOSTED_AUTH_FAVICON_BASE_PATH): string {
  const icon: Array<{ url: string; sizes?: string; type: string }> = [
    { url: `${basePath}/favicon.ico`, type: "image/x-icon" },
    { url: `${basePath}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
    { url: `${basePath}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
    { url: `${basePath}/favicon-96x96.png`, sizes: "96x96", type: "image/png" },
  ];
  const lines = icon.map((entry) => {
    const sizes = entry.sizes ? ` sizes="${entry.sizes}"` : "";
    return `  <link rel="icon" type="${entry.type}"${sizes} href="${entry.url}">`;
  });
  lines.push(`  <link rel="apple-touch-icon" href="${basePath}/apple-touch-icon.png">`);
  return lines.join("\n");
}
