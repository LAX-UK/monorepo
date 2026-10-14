import {
  isShopIndexingAllowed,
  loadShopStorefrontBaseUrl,
} from "@/lib/ecosystem/product-directory.server";
import { composeShopRobots } from "@/lib/seo/shop-indexing";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return composeShopRobots(loadShopStorefrontBaseUrl(), isShopIndexingAllowed());
}
