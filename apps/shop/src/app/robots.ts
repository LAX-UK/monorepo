import { loadShopStorefrontBaseUrl } from "@/lib/ecosystem/product-directory.server";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = loadShopStorefrontBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
