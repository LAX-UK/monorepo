import { type SalesChannel, isListedOnSalesChannel } from "@auction/shop-domain";
import type { ArtworkCatalogueReader } from "../ports/artwork-catalogue.reader.js";

export type GetPublicArtworkHandler = (
  slug: string,
  salesChannel?: SalesChannel,
) => ReturnType<ArtworkCatalogueReader["getPublicArtworkBySlug"]>;

/**
 * One public artwork. Asked for by a storefront, it is returned only when that storefront lists
 * it, so lax.art never opens an edition and Shop never opens an original.
 */
export function createGetPublicArtworkHandler(
  reader: ArtworkCatalogueReader,
): GetPublicArtworkHandler {
  return async (slug, salesChannel) => {
    const artwork = await reader.getPublicArtworkBySlug(slug);
    if (!artwork) return null;
    if (salesChannel !== undefined && !isListedOnSalesChannel(artwork, salesChannel)) return null;
    return artwork;
  };
}
