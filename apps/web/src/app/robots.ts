import { CLIENT_AREA_PREFIXES } from "@/lib/navigation/client-routes";
import { isIndexingAllowedAtBuildTime } from "@/lib/seo/is-indexing-allowed";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

// Evaluate at request time so the production origin env (NEXT_PUBLIC_WEB_ORIGIN)
// is read at runtime rather than frozen from a build that lacked it.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  const rules: MetadataRoute.Robots = {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The signed-in client area, the old `/dashboard` addresses that redirect into it, and staff.
        disallow: [
          ...CLIENT_AREA_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/`]),
          "/dashboard",
          "/dashboard/",
          "/admin",
          "/admin/",
          "/api/",
          "/api",
        ],
      },
    ],
  };

  if (isIndexingAllowedAtBuildTime()) {
    rules.sitemap = `${base}/sitemap.xml`;
    rules.host = base;
  }

  return rules;
}
