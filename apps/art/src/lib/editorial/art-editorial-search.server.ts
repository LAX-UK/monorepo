import {
  ExhibitionListSchema,
  StoryListSchema,
  fetchEditorial,
} from "@/lib/editorial/art-editorial.server";
import type {
  ArtEditorialExhibitionList,
  ArtEditorialFetchResult,
  ArtEditorialStoryList,
} from "@/lib/editorial/art-editorial.types";

/** Every published exhibition (current, upcoming and past) whose title or summary matches. */
export function searchEditorialExhibitions(
  query: string,
): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionList>> {
  return fetchEditorial(
    `/v1/editorial/exhibitions?q=${encodeURIComponent(query)}`,
    ExhibitionListSchema,
  );
}

/** Published stories whose title or standfirst matches. */
export function searchEditorialStories(
  query: string,
): Promise<ArtEditorialFetchResult<ArtEditorialStoryList>> {
  return fetchEditorial(`/v1/editorial/stories?q=${encodeURIComponent(query)}`, StoryListSchema);
}
