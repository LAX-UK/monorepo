import { loadShopEnv } from "@/env";
import { mediaSrcResolverFrom } from "@auction/marketing-ui";
import { type CatalogueImageOrigins, createCatalogueImageResolver } from "@auction/shop-contracts";

export function loadShopCatalogueImageOrigins(): CatalogueImageOrigins {
  const env = loadShopEnv();
  return {
    shop: env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL,
    art: env.LAX_ART_PUBLIC_URL,
  };
}

/** For server-rendered images: seed paths stay relative on Shop and rebase elsewhere. */
export function shopCatalogueImageSrcResolver() {
  return mediaSrcResolverFrom(
    createCatalogueImageResolver("shop", loadShopCatalogueImageOrigins()),
  );
}
