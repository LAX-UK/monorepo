export type ArtworkSaleState = "for_sale" | "price_on_application" | "sold";

export type EditionAvailabilityReadModel = {
  totalEditions: number;
  editionsAvailable: number;
};

export type ArtworkSummaryReadModel = {
  slug: string;
  title: string;
  artistName: string;
  imageUrl: string | null;
  saleState: ArtworkSaleState;
  dimensions: string | null;
  yearCreated: number | null;
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  availability: EditionAvailabilityReadModel;
};

export type ArtworkDetailReadModel = ArtworkSummaryReadModel & {
  description: string | null;
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
};

export type CategorySummaryReadModel = {
  slug: string;
  label: string;
  imageUrl: string | null;
  artworkCount: number;
};
