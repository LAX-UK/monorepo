import type { Database } from "@auction/db";
import { savedSearch } from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type {
  ISavedSearchRepository,
  SavedSearchRow,
} from "../interfaces/saved-search.repository.js";

export class DrizzleSavedSearchRepository implements ISavedSearchRepository {
  constructor(private readonly db: Database) {}

  list(userId: string): Promise<SavedSearchRow[]> {
    return this.db
      .select()
      .from(savedSearch)
      .where(eq(savedSearch.userId, userId))
      .orderBy(desc(savedSearch.createdAt));
  }

  async create(
    userId: string,
    input: { label: string; query: Record<string, string>; notifyEmail: boolean },
  ): Promise<SavedSearchRow> {
    const [row] = await this.db
      .insert(savedSearch)
      .values({
        userId,
        label: input.label,
        query: input.query,
        notifyEmail: input.notifyEmail,
      })
      .returning();
    if (!row) throw new Error("saved_search_insert_failed");
    return row;
  }

  async setNotifyEmail(
    userId: string,
    id: string,
    notifyEmail: boolean,
  ): Promise<SavedSearchRow | null> {
    const [row] = await this.db
      .update(savedSearch)
      .set({ notifyEmail })
      .where(and(eq(savedSearch.id, id), eq(savedSearch.userId, userId)))
      .returning();
    return row ?? null;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(savedSearch)
      .where(and(eq(savedSearch.id, id), eq(savedSearch.userId, userId)))
      .returning({ id: savedSearch.id });
    return deleted.length > 0;
  }
}
