import { isArtIndexingAllowed, loadArtStorefrontBaseUrl } from "@/env.server";
import { composeArtRobots } from "@/lib/seo/art-robots";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return composeArtRobots(loadArtStorefrontBaseUrl(), isArtIndexingAllowed());
}
