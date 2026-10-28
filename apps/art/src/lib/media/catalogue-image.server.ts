import { loadArtEnv } from "@/env.server";
import { mediaSrcResolverFrom } from "@auction/marketing-ui";
import { type CatalogueImageOrigins, createCatalogueImageResolver } from "@auction/shop-contracts";

export function loadArtCatalogueImageOrigins(): CatalogueImageOrigins {
  const env = loadArtEnv();
  return {
    shop: env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL,
    art: env.LAX_ART_PUBLIC_URL,
  };
}

/** For server-rendered images: seed paths stay relative on lax.art and rebase elsewhere. */
export function artCatalogueImageSrcResolver() {
  return mediaSrcResolverFrom(createCatalogueImageResolver("art", loadArtCatalogueImageOrigins()));
}
