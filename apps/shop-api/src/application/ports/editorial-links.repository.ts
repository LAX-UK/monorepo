import type {
  EditorialExhibitionLinkList,
  EditorialExhibitionLinksResponse,
  EditorialLinkCandidatesResponse,
  EditorialLinkKind,
  EditorialStoryLinkList,
  EditorialStoryLinksResponse,
} from "@auction/shop-contracts";

/** The write was applied (or refused) without throwing, so routes can map each case to a status. */
export type ReplaceEditorialLinksOutcome =
  | { status: "replaced"; version: string }
  | { status: "parent_not_found" }
  | { status: "stale"; currentVersion: string }
  | { status: "unknown_ids"; missingIds: string[] };

type ReplaceInput<List extends string> = {
  parentId: string;
  list: List;
  /** Already validated: unique and within the length cap. */
  ids: string[];
  expectedVersion: string;
  actorSubjectId: string;
};

export type ReplaceExhibitionLinksInput = ReplaceInput<EditorialExhibitionLinkList>;
export type ReplaceStoryLinksInput = ReplaceInput<EditorialStoryLinkList>;

export type SearchEditorialLinkCandidatesInput = {
  kind: EditorialLinkKind;
  q: string;
  cursor: string | null;
  limit: number;
};

export type EditorialLinksRepository = {
  /** Null when the exhibition does not exist. */
  getExhibitionLinks(exhibitionId: string): Promise<EditorialExhibitionLinksResponse | null>;
  /** Null when the story does not exist. */
  getStoryLinks(storyId: string): Promise<EditorialStoryLinksResponse | null>;
  replaceExhibitionLinks(input: ReplaceExhibitionLinksInput): Promise<ReplaceEditorialLinksOutcome>;
  replaceStoryLinks(input: ReplaceStoryLinksInput): Promise<ReplaceEditorialLinksOutcome>;
  searchCandidates(
    input: SearchEditorialLinkCandidatesInput,
  ): Promise<EditorialLinkCandidatesResponse>;
};
