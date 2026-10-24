export type AdminSavedViewRecord = {
  id: string;
  listKey: string;
  label: string;
  /** URL search params (no leading "?") that define the view. */
  query: string;
  position: number;
};

export type CreateAdminSavedViewInput = {
  ownerSubjectId: string;
  listKey: string;
  label: string;
  query: string;
  /** Most views one person may keep for a list. */
  maxPerList: number;
};

export type CreateAdminSavedViewResult =
  | { status: "created"; view: AdminSavedViewRecord }
  | { status: "duplicate_label" }
  | { status: "limit_reached" };

export type RenameAdminSavedViewResult =
  | { status: "renamed"; view: AdminSavedViewRecord }
  | { status: "duplicate_label" }
  | { status: "not_found" };

export type ReorderAdminSavedViewsResult =
  | { status: "reordered"; views: AdminSavedViewRecord[] }
  /** The ids are not exactly the person's current views for the list (changed elsewhere). */
  | { status: "mismatch" };

/**
 * A staff member's saved table views. Every method is scoped to the owner: one person can never
 * read or change another's views.
 */
export interface IAdminSavedViewRepository {
  list(ownerSubjectId: string, listKey: string): Promise<AdminSavedViewRecord[]>;
  create(input: CreateAdminSavedViewInput): Promise<CreateAdminSavedViewResult>;
  rename(ownerSubjectId: string, id: string, label: string): Promise<RenameAdminSavedViewResult>;
  reorder(
    ownerSubjectId: string,
    listKey: string,
    ids: readonly string[],
  ): Promise<ReorderAdminSavedViewsResult>;
  remove(ownerSubjectId: string, id: string): Promise<boolean>;
}
