export type SavedViewRecord = {
  id: string;
  listKey: string;
  label: string;
  /** URL search params (no leading "?") that define the view. */
  query: string;
  position: number;
};

export type CreateSavedViewInput = {
  ownerSubjectId: string;
  listKey: string;
  label: string;
  query: string;
  /** Most views one person may keep for a list. */
  maxPerList: number;
};

export type CreateSavedViewOutcome =
  | { status: "created"; view: SavedViewRecord }
  | { status: "duplicate_label" }
  | { status: "limit_reached" };

export type RenameSavedViewOutcome =
  | { status: "renamed"; view: SavedViewRecord }
  | { status: "duplicate_label" }
  | { status: "not_found" };

export type ReorderSavedViewsOutcome =
  | { status: "reordered"; views: SavedViewRecord[] }
  /** The ids are not exactly the person's current views for the list (changed elsewhere). */
  | { status: "mismatch" };

/**
 * A staff member's saved table views. Every method is scoped to the owner: one person can never
 * read or change another's views.
 */
export interface SavedViewRepository {
  list(ownerSubjectId: string, listKey: string): Promise<SavedViewRecord[]>;
  create(input: CreateSavedViewInput): Promise<CreateSavedViewOutcome>;
  rename(ownerSubjectId: string, id: string, label: string): Promise<RenameSavedViewOutcome>;
  reorder(
    ownerSubjectId: string,
    listKey: string,
    ids: readonly string[],
  ): Promise<ReorderSavedViewsOutcome>;
  remove(ownerSubjectId: string, id: string): Promise<boolean>;
}
