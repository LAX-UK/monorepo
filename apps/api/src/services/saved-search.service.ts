import type {
  ISavedSearchRepository,
  SavedSearchRow,
} from "../repositories/interfaces/saved-search.repository.js";

export type { SavedSearchRow } from "../repositories/interfaces/saved-search.repository.js";

export class SavedSearchService {
  constructor(private readonly savedSearches: ISavedSearchRepository) {}

  list(userId: string): Promise<SavedSearchRow[]> {
    return this.savedSearches.list(userId);
  }

  create(
    userId: string,
    input: { label: string; query: Record<string, string>; notifyEmail: boolean },
  ): Promise<SavedSearchRow> {
    return this.savedSearches.create(userId, input);
  }

  remove(userId: string, id: string): Promise<boolean> {
    return this.savedSearches.remove(userId, id);
  }
}
