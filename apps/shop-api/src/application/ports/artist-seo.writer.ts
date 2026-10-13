import type { SeoFields } from "@auction/shop-contracts";

export interface ArtistSeoWriter {
  /** Returns false when the artist does not exist. */
  updateArtistSeo(artistId: string, fields: SeoFields): Promise<boolean>;
}
