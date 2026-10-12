import { loadArtStorefrontBaseUrl } from "@/env.server";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = loadArtStorefrontBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
