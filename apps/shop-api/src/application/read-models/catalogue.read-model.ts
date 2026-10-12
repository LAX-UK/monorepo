export type ArtworkSaleState = "for_sale" | "price_on_application" | "sold";

export type EditionAvailabilityReadModel = {
  totalEditions: number;
  editionsAvailable: number;
};

export type ArtworkImageReadModel = {
  url: string;
  alt: string | null;
  caption: string | null;
  blurDataUrl: string | null;
};

export type ArtworkObjectType =
  | "painting"
  | "work_on_paper"
  | "sculpture"
  | "photography"
  | "print"
  | "mixed_media";

export type ArtworkRarity = "unique" | "limited_edition" | "open_edition";

export type ArtworkObjectTypeFacetReadModel = {
  objectType: ArtworkObjectType;
  artworkCount: number;
  coverImageUrl: string | null;
};

export type ArtworkSummaryReadModel = {
  slug: string;
  title: string;
  artistName: string;
  artistSlug: string;
  imageUrl: string | null;
  saleState: ArtworkSaleState;
  dimensions: string | null;
  dimensionsCmDisplay: string | null;
  medium: string | null;
  yearCreated: number | null;
  objectType: ArtworkObjectType | null;
  rarity: ArtworkRarity | null;
  salesChannel: "shop" | "art";
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  availability: EditionAvailabilityReadModel;
};

export type ArtworkDetailReadModel = ArtworkSummaryReadModel & {
  description: string | null;
  images: ArtworkImageReadModel[];
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  hasCertificate: boolean;
  provenance: string | null;
  exhibitionHistory: string | null;
};

export type ArtistSummaryReadModel = {
  slug: string;
  name: string;
  discipline: string | null;
  portraitUrl: string | null;
  artworkCount: number;
};

export type ArtistDetailReadModel = ArtistSummaryReadModel & {
  bio: string | null;
  shortBio: string | null;
  heroUrl: string | null;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
};

export type CategorySummaryReadModel = {
  slug: string;
  label: string;
  imageUrl: string | null;
  artworkCount: number;
};
