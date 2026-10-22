import {
  EDITORIAL_LINKS_MAX_IDS,
  EDITORIAL_LINK_CANDIDATES_DEFAULT_LIMIT,
  type EditorialExhibitionLinkList,
  type EditorialLinkCandidatesQuery,
  type EditorialStoryLinkList,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopApiError } from "../errors/shop-api-error.js";
import type {
  EditorialLinksRepository,
  ReplaceEditorialLinksOutcome,
} from "./ports/editorial-links.repository.js";

type ReplaceCommand<List extends string> = {
  parentId: string;
  list: List;
  ids: string[];
  expectedVersion: string;
  actorSubjectId: string;
};

function assertValidIds(ids: string[]): void {
  if (ids.length > EDITORIAL_LINKS_MAX_IDS) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `At most ${EDITORIAL_LINKS_MAX_IDS} links are allowed`,
      400,
    );
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    const key = id.toLowerCase();
    if (seen.has(key)) duplicates.add(id);
    seen.add(key);
  }
  if (duplicates.size > 0) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `Duplicate ids: ${[...duplicates].join(", ")}`,
      400,
    );
  }
}

/** Stops malformed lists before they reach the transaction; existence is checked inside it. */
export function createEditorialLinksService(repository: EditorialLinksRepository) {
  return {
    getExhibitionLinks: (exhibitionId: string) => repository.getExhibitionLinks(exhibitionId),
    getStoryLinks: (storyId: string) => repository.getStoryLinks(storyId),

    replaceExhibitionLinks(
      command: ReplaceCommand<EditorialExhibitionLinkList>,
    ): Promise<ReplaceEditorialLinksOutcome> {
      assertValidIds(command.ids);
      return repository.replaceExhibitionLinks(command);
    },

    replaceStoryLinks(
      command: ReplaceCommand<EditorialStoryLinkList>,
    ): Promise<ReplaceEditorialLinksOutcome> {
      assertValidIds(command.ids);
      return repository.replaceStoryLinks(command);
    },

    searchCandidates: (query: EditorialLinkCandidatesQuery) =>
      repository.searchCandidates({
        kind: query.kind,
        q: query.q?.trim() ?? "",
        cursor: query.cursor ?? null,
        limit: query.limit ?? EDITORIAL_LINK_CANDIDATES_DEFAULT_LIMIT,
      }),
  };
}

export type EditorialLinksService = ReturnType<typeof createEditorialLinksService>;
