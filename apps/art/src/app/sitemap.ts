import { isArtIndexingAllowed, loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeArtSitemap } from "@/lib/seo/art-sitemap.composer";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isArtIndexingAllowed()) return [];
  return composeArtSitemap(artServices, loadArtStorefrontBaseUrl());
}
