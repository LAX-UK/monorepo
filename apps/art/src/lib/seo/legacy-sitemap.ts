function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Old www.thelax.art page URLs, submitted after cutover so Google recrawls them and follows the
 * 301s quickly. Media paths are left to the image crawler.
 */
export function buildLegacySitemapXml(
  redirects: Readonly<Record<string, string>>,
  baseUrl: URL,
): string {
  const urls = Object.keys(redirects)
    .filter((path) => !path.startsWith("/uds/"))
    .sort()
    .map((path) => `<url><loc>${escapeXml(new URL(path, baseUrl).toString())}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}
