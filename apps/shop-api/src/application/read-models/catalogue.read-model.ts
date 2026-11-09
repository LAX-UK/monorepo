import type {
  PublicEditionFacts,
  PublicEditionRun,
  PublicProofsKept,
  PublicSetApart,
} from "@auction/shop-domain";

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
  /** Every price band in band order, empty ones included. */
  priceBands: Array<{ key: string; count: number }>;
  /** Every size band in band order, empty ones included. */
  sizes: Array<{ key: string; count: number }>;
  /** Techniques with works, most works first. */
  techniques: Array<{ value: string; count: number }>;
  /** Object types (the medium on lax.art) with works, in canonical type order. */
  objectTypes: Array<{ key: string; count: number }>;
  /** Sale states with works: for sale, price on request and sold. */
  saleStates: Array<{ key: string; count: number }>;
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
  /** The shop-domain card line of an edition run with confirmed facts; otherwise null. */
  editionCardLine?: string | null;
  /** The slug of the listing all versions of this work hang from (its own when it is the main run). */
  workSlug?: string;
};

export type ArtworkEditionReadModel = {
  run: PublicEditionRun;
  /** Null until staff confirm the facts. */
  facts: PublicEditionFacts | null;
  proofsKept: PublicProofsKept | null;
  otherRuns: Array<{
    slug: string;
    run: PublicEditionRun;
    facts: PublicEditionFacts | null;
    printPricePence: number | null;
    availability: "available" | "sold_out";
    /** Set when the listing is one print of the run sold on its own. */
    setApart?: PublicSetApart;
  }>;
  /** Set when this page is one print of a run sold on its own. */
  setApart?: PublicSetApart;
  /** The title of the run that print came from. */
  runTitle?: string;
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
  /** The run and its confirmed facts; absent for an original. */
  edition?: ArtworkEditionReadModel | null;
};

export type ArtistSummaryReadModel = {
  slug: string;
  name: string;
  discipline: string | null;
  portraitUrl: string | null;
  artworkCount: number;
  /** The newest listed work's picture; used when the artist has no portrait. */
  leadImageUrl?: string | null;
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
