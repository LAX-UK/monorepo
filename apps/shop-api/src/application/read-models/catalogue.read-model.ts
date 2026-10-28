export type ArtworkSaleState = "for_sale" | "price_on_application" | "sold";

export type EditionAvailabilityReadModel = {
  totalEditions: number;
  state: "available" | "sold_out";
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

/**
 * Counts beside each catalogue filter option. Each group is counted with every other filter
 * applied but not its own, so an option shows how many works choosing it would give.
 */
export type ArtworkFacetCountsReadModel = {
  availability: { available: number; soldOut: number };
  categories: Array<{ slug: string; label: string; count: number }>;
  artists: Array<{ slug: string; name: string; count: number }>;
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
  updatedAt: string;
  /** When the work was first listed. */
  listedAt: string;
};

export type ArtworkDetailReadModel = ArtworkSummaryReadModel & {
  description: string | null;
  images: ArtworkImageReadModel[];
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  hasCertificate: boolean;
  printPaper: string | null;
  printSize: string | null;
  /** The linked original's slug while it is on lax.art; otherwise null. */
  sourceOriginalSlug: string | null;
  provenance: string | null;
  exhibitionHistory: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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
  seoTitle: string | null;
  seoDescription: string | null;
};

export type CategorySummaryReadModel = {
  slug: string;
  label: string;
  imageUrl: string | null;
  artworkCount: number;
};
