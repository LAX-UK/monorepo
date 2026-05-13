import type { Database } from "@auction/db";
import { userUiPreference } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ThemePreference, UiPreferencePatch } from "@auction/validators";
import type { IUiPreferenceRepository, UiPreferenceRow } from "../services/interfaces/ui-preference.js";

export class DrizzleUiPreferenceRepository implements IUiPreferenceRepository {
  constructor(private readonly db: Database) {}

  async getForUser(userId: string): Promise<UiPreferenceRow | null> {
    const [row] = await this.db
      .select()
      .from(userUiPreference)
      .where(eq(userUiPreference.userId, userId))
      .limit(1);
    return row
      ? {
          userId: row.userId,
          theme: row.theme as ThemePreference,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async upsert(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(userUiPreference)
      .values({
        userId,
        theme: patch.theme,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userUiPreference.userId,
        set: { theme: patch.theme, updatedAt: now },
      })
      .returning();
    if (!row) throw new Error("user_ui_preference upsert returned no row");
    return {
      userId: row.userId,
      theme: row.theme as ThemePreference,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
