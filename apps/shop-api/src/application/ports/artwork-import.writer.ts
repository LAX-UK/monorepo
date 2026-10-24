export type ImportArtworkObjectType =
  | "painting"
  | "work_on_paper"
  | "sculpture"
  | "photography"
  | "print"
  | "mixed_media";

export type ImportArtworkRarity = "unique" | "limited_edition" | "open_edition";

export type ImportArtworkCommand = {
  importKey: string;
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  dimensions?: string | null;
  /** Omitted leaves an existing value unchanged on re-import; `null` clears it. */
  medium?: string | null;
  yearCreated?: number | null;
  saleState?: "for_sale" | "price_on_application" | "sold";
  artistSlug: string;
  artistDisplayName: string;
  artistDiscipline?: string | null;
  artistPortraitUrl?: string | null;
  eligibleForEditionAllocation: boolean;
  printPricePence?: number | null;
  /** Fields below follow `medium`: omitted leaves the stored value unchanged. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  salesChannel?: "shop" | "art";
  objectType?: ImportArtworkObjectType | null;
  rarity?: ImportArtworkRarity | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  hasCertificate?: boolean;
  /**
   * New artworks start as drafts, like those created in the editor, unless this is true (seeds,
   * test fixtures and the legacy-site migration). A re-import never changes the published state.
   */
  publishOnCreate?: boolean;
  /** Replaces the gallery (in order) when provided. */
  images?: ReadonlyArray<{ mediaKey: string; alt: string | null }>;
};

export type ImportArtworkResult = {
  artworkId: string;
  created: boolean;
  editionCount: number;
};

export interface ArtworkImportWriter {
  importArtwork(command: ImportArtworkCommand): Promise<ImportArtworkResult>;
}
