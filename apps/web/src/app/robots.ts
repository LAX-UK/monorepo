import { isIndexingAllowedAtBuildTime } from "@/lib/seo/is-indexing-allowed";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  const rules: MetadataRoute.Robots = {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/dashboard/", "/admin", "/admin/", "/api/", "/api"],
      },
    ],
  };

  if (isIndexingAllowedAtBuildTime()) {
    rules.sitemap = `${base}/sitemap.xml`;
    rules.host = base;
  }

  return rules;
}
