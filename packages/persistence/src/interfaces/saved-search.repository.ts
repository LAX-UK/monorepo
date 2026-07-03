import type { savedSearch } from "@auction/db/schema";

export type SavedSearchRow = typeof savedSearch.$inferSelect;

export interface ISavedSearchRepository {
  list(userId: string): Promise<SavedSearchRow[]>;
  create(
    userId: string,
    input: { label: string; query: Record<string, string>; notifyEmail: boolean },
  ): Promise<SavedSearchRow>;
  remove(userId: string, id: string): Promise<boolean>;
}
