import type {
  EditorialExhibitionSummaryReadModel,
  EditorialStoryListItemReadModel,
} from "./editorial.repository.js";

/** Case-insensitive text search over published editorial, for storefront site search. */
export type EditorialSearchReader = {
  /** Every published exhibition (current, upcoming and past) whose title or summary matches. */
  searchExhibitions(query: string): Promise<EditorialExhibitionSummaryReadModel[]>;
  /** Published stories whose title or standfirst matches, optionally of one kind. */
  searchStories(
    query: string,
    kind?: "article" | "film" | "press" | "guide",
  ): Promise<EditorialStoryListItemReadModel[]>;
};
