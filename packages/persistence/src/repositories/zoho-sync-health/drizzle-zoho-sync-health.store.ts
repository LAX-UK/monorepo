import type { Database } from "@auction/db";
import { zohoSyncHealth } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IZohoSyncHealthReader,
  IZohoSyncHealthStore,
  ZohoSyncHealthRecord,
  ZohoSyncModes,
} from "../../interfaces/zoho-sync-health.js";

const ROW_ID = "zoho";

/** The one health row: written by the worker, read by LAX Admin. */
export class DrizzleZohoSyncHealthStore implements IZohoSyncHealthStore, IZohoSyncHealthReader {
  constructor(private readonly db: Database) {}

  async reportModes(modes: ZohoSyncModes, now: Date): Promise<void> {
    const values = {
      artworkSyncMode: modes.artworkSync,
      listingMode: modes.listing,
      modesReportedAt: now,
      updatedAt: now,
    };
    await this.db
      .insert(zohoSyncHealth)
      .values({ id: ROW_ID, ...values })
      .onConflictDoUpdate({ target: zohoSyncHealth.id, set: values });
  }

  async recordTokenRefreshed(expiresAt: Date, now: Date): Promise<void> {
    const values = {
      tokenRefreshedAt: now,
      tokenExpiresAt: expiresAt,
      tokenFailureStreak: 0,
      updatedAt: now,
    };
    await this.db
      .insert(zohoSyncHealth)
      .values({ id: ROW_ID, ...values })
      .onConflictDoUpdate({ target: zohoSyncHealth.id, set: values });
  }

  async recordTokenRefreshFailed(code: string, now: Date): Promise<{ failureStreak: number }> {
    const [row] = await this.db
      .insert(zohoSyncHealth)
      .values({
        id: ROW_ID,
        tokenFailureStreak: 1,
        tokenLastFailureAt: now,
        tokenLastFailureCode: code,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: zohoSyncHealth.id,
        set: {
          tokenFailureStreak: sql`${zohoSyncHealth.tokenFailureStreak} + 1`,
          tokenLastFailureAt: now,
          tokenLastFailureCode: code,
          updatedAt: now,
        },
      })
      .returning({ failureStreak: zohoSyncHealth.tokenFailureStreak });
    return { failureStreak: row?.failureStreak ?? 1 };
  }

  async read(): Promise<ZohoSyncHealthRecord | null> {
    const [row] = await this.db
      .select()
      .from(zohoSyncHealth)
      .where(eq(zohoSyncHealth.id, ROW_ID))
      .limit(1);
    if (!row) return null;
    return {
      modes:
        row.artworkSyncMode && row.listingMode
          ? { artworkSync: row.artworkSyncMode, listing: row.listingMode }
          : null,
      modesReportedAt: row.modesReportedAt,
      token: {
        refreshedAt: row.tokenRefreshedAt,
        expiresAt: row.tokenExpiresAt,
        failureStreak: row.tokenFailureStreak,
        lastFailureAt: row.tokenLastFailureAt,
        lastFailureCode: row.tokenLastFailureCode,
      },
    };
  }
}
