export type PortalArtistProfile = {
  artistId: string;
  slug: string;
  displayName: string;
};

export type PortalArtistArtworkRow = {
  artworkId: string;
  slug: string;
  title: string;
  saleState: string;
};

export type PortalArtistSaleRow = {
  saleId: string;
  channel: string;
  artworkTitle: string;
  editionNumber: number | null;
  grossPence: number;
  occurredAt: string | null;
};

export interface PortalArtistReader {
  getLinkedArtist(identitySubjectId: string): Promise<PortalArtistProfile | null>;
  listArtworks(identitySubjectId: string): Promise<PortalArtistArtworkRow[]>;
  listSales(identitySubjectId: string): Promise<PortalArtistSaleRow[]>;
}
