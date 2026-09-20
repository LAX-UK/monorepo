export type ImportArtworkCommand = {
  importKey: string;
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  dimensions?: string | null;
  yearCreated?: number | null;
  saleState?: "for_sale" | "price_on_application" | "sold";
  artistSlug: string;
  artistDisplayName: string;
  artistDiscipline?: string | null;
  artistPortraitUrl?: string | null;
  eligibleForEditionAllocation: boolean;
  printPricePence?: number | null;
};

export type ImportArtworkResult = {
  artworkId: string;
  created: boolean;
  editionCount: number;
};

export interface ArtworkImportWriter {
  importArtwork(command: ImportArtworkCommand): Promise<ImportArtworkResult>;
}
