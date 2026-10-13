import { isArtIndexingAllowed, loadArtStorefrontBaseUrl } from "@/env.server";
import { legacyRedirects } from "@/lib/seo/legacy-redirects";
import { buildLegacySitemapXml } from "@/lib/seo/legacy-sitemap";

export const dynamic = "force-dynamic";

export function GET() {
  if (!isArtIndexingAllowed()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(buildLegacySitemapXml(legacyRedirects, loadArtStorefrontBaseUrl()), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
