import type { Database } from "@auction/db";
import { userUiPreference } from "@auction/db/schema";
import type {
  DensityPreference,
  LayoutViewDefault,
  ThemePreference,
  UiPreferencePatch,
} from "@auction/validators";
import { eq } from "drizzle-orm";
import type {
  IUiPreferenceRepository,
  UiPreferenceRow,
} from "../services/interfaces/ui-preference.js";

const DEFAULT_THEME = "system" as const;
const DEFAULT_VIEW = "auto" as const;
const DEFAULT_DENSITY = "comfortable" as const;

function rowToDomain(row: {
  userId: string;
  theme: string;
  viewLotsDefault: string;
  viewArtistsDefault: string;
  viewSalesDefault: string;
  density: string;
  viewSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UiPreferenceRow {
  return {
    userId: row.userId,
    theme: row.theme as ThemePreference,
    viewLotsDefault: row.viewLotsDefault as LayoutViewDefault,
    viewArtistsDefault: row.viewArtistsDefault as LayoutViewDefault,
    viewSalesDefault: row.viewSalesDefault as LayoutViewDefault,
    density: row.density as DensityPreference,
    viewSync: row.viewSync,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mergePatch(
  existing: UiPreferenceRow | null,
  patch: UiPreferencePatch,
): {
  theme: ThemePreference;
  viewLotsDefault: LayoutViewDefault;
  viewArtistsDefault: LayoutViewDefault;
  viewSalesDefault: LayoutViewDefault;
  density: DensityPreference;
  viewSync: boolean;
} {
  const base = existing ?? {
    userId: "",
    theme: DEFAULT_THEME,
    viewLotsDefault: DEFAULT_VIEW,
    viewArtistsDefault: DEFAULT_VIEW,
    viewSalesDefault: DEFAULT_VIEW,
    density: DEFAULT_DENSITY,
    viewSync: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  return {
    theme: patch.theme ?? base.theme,
    viewLotsDefault: patch.viewLotsDefault ?? base.viewLotsDefault,
    viewArtistsDefault: patch.viewArtistsDefault ?? base.viewArtistsDefault,
    viewSalesDefault: patch.viewSalesDefault ?? base.viewSalesDefault,
    density: patch.density ?? base.density,
    viewSync: patch.viewSync ?? base.viewSync,
  };
}

export class DrizzleUiPreferenceRepository implements IUiPreferenceRepository {
  constructor(private readonly db: Database) {}

  async getForUser(userId: string): Promise<UiPreferenceRow | null> {
    const [row] = await this.db
      .select()
      .from(userUiPreference)
      .where(eq(userUiPreference.userId, userId))
      .limit(1);
    return row ? rowToDomain(row) : null;
  }

  async upsert(userId: string, patch: UiPreferencePatch): Promise<UiPreferenceRow> {
    const existing = await this.getForUser(userId);
    const merged = mergePatch(existing, patch);
    const now = new Date();
    const [row] = await this.db
      .insert(userUiPreference)
      .values({
        userId,
        theme: merged.theme,
        viewLotsDefault: merged.viewLotsDefault,
        viewArtistsDefault: merged.viewArtistsDefault,
        viewSalesDefault: merged.viewSalesDefault,
        density: merged.density,
        viewSync: merged.viewSync,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userUiPreference.userId,
        set: {
          ...(patch.theme !== undefined ? { theme: merged.theme } : {}),
          ...(patch.viewLotsDefault !== undefined
            ? { viewLotsDefault: merged.viewLotsDefault }
            : {}),
          ...(patch.viewArtistsDefault !== undefined
            ? { viewArtistsDefault: merged.viewArtistsDefault }
            : {}),
          ...(patch.viewSalesDefault !== undefined
            ? { viewSalesDefault: merged.viewSalesDefault }
            : {}),
          ...(patch.density !== undefined ? { density: merged.density } : {}),
          ...(patch.viewSync !== undefined ? { viewSync: merged.viewSync } : {}),
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("user_ui_preference upsert returned no row");
    return rowToDomain(row);
  }

  async resetLayoutDefaults(userId: string): Promise<UiPreferenceRow> {
    const now = new Date();
    const existing = await this.getForUser(userId);
    if (!existing) {
      const [row] = await this.db
        .insert(userUiPreference)
        .values({
          userId,
          theme: DEFAULT_THEME,
          viewLotsDefault: DEFAULT_VIEW,
          viewArtistsDefault: DEFAULT_VIEW,
          viewSalesDefault: DEFAULT_VIEW,
          density: DEFAULT_DENSITY,
          viewSync: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("user_ui_preference insert returned no row");
      return rowToDomain(row);
    }
    const [row] = await this.db
      .update(userUiPreference)
      .set({
        viewLotsDefault: DEFAULT_VIEW,
        viewArtistsDefault: DEFAULT_VIEW,
        viewSalesDefault: DEFAULT_VIEW,
        updatedAt: now,
      })
      .where(eq(userUiPreference.userId, userId))
      .returning();
    if (!row) throw new Error("user_ui_preference reset returned no row");
    return rowToDomain(row);
  }
}
