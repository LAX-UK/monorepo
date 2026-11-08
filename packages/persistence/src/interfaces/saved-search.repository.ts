import type { savedSearch } from "@auction/db/schema";

export type SavedSearchRow = typeof savedSearch.$inferSelect;

export interface ISavedSearchRepository {
  list(userId: string): Promise<SavedSearchRow[]>;
  create(
    userId: string,
    input: { label: string; query: Record<string, string>; notifyEmail: boolean },
  ): Promise<SavedSearchRow>;
  /** Sets email alerts for the person's own saved search; null when it is not theirs. */
  setNotifyEmail(userId: string, id: string, notifyEmail: boolean): Promise<SavedSearchRow | null>;
  remove(userId: string, id: string): Promise<boolean>;
}
