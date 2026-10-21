import type {
  EditorialArtistRelationsSchema,
  EditorialBlock,
  EditorialExhibitionDetailSchema,
  EditorialExhibitionSummarySchema,
  EditorialHomeResponse,
  EditorialPageDetailSchema,
  EditorialPageSummarySchema,
  EditorialStoryDetailSchema,
  EditorialStoryListQuery,
  EditorialStorySummarySchema,
  EditorialVenueDetailSchema,
  EditorialVenueSummarySchema,
} from "@auction/shop-contracts";

export type ArtEditorialFetchResult<T> =
  | { status: "disabled" }
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "error" };

export type ArtEditorialExhibitionSummary = typeof EditorialExhibitionSummarySchema.static;
export type ArtEditorialExhibitionDetail = typeof EditorialExhibitionDetailSchema.static;
export type ArtEditorialStorySummary = typeof EditorialStorySummarySchema.static;
export type ArtEditorialStoryDetail = typeof EditorialStoryDetailSchema.static;
export type ArtEditorialPageDetail = typeof EditorialPageDetailSchema.static;
export type ArtEditorialPageSummary = typeof EditorialPageSummarySchema.static;
export type ArtEditorialVenueSummary = typeof EditorialVenueSummarySchema.static;
export type ArtEditorialVenueDetail = typeof EditorialVenueDetailSchema.static;
export type ArtEditorialPlacement = EditorialHomeResponse["placements"][number];
export type ArtEditorialArtistRelations = typeof EditorialArtistRelationsSchema.static;

export type ArtEditorialExhibitionList = { items: ArtEditorialExhibitionSummary[] };
export type ArtEditorialStoryList = { items: ArtEditorialStorySummary[] };
export type ArtEditorialPageList = { items: ArtEditorialPageSummary[] };
export type ArtEditorialVenueList = { items: ArtEditorialVenueSummary[] };

/** Draft preview normalised across venue, exhibition, story and page entities. */
export type ArtEditorialPreview = {
  title: string;
  summary: string | null;
  coverUrl: string | null;
  body: EditorialBlock[];
};

export type ArtExhibitionStatus = "current" | "upcoming" | "past";
/** Story list filters: format (`kind`), editorial `category` and `series`; combined with AND. */
export type ArtStoryListFilter = EditorialStoryListQuery;
