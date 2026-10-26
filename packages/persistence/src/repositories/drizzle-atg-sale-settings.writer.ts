import type { Database } from "@auction/db";
import { atgAuctionLink } from "@auction/db/schema";
import type { AtgSaleSettings } from "@auction/types";
import { sql } from "drizzle-orm";
import type { IAtgSaleSettingsWriter } from "../interfaces/index.js";

export class DrizzleAtgSaleSettingsWriter implements IAtgSaleSettingsWriter {
  constructor(private readonly db: Database) {}

  async saveSettings(
    saleId: string,
    settings: AtgSaleSettings,
    actorUserId: string,
    at: Date,
  ): Promise<boolean> {
    const values = {
      auctionType: settings.auctionType,
      distribution: settings.distribution,
      settingsUpdatedAt: at,
      settingsUpdatedBy: actorUserId,
    };
    const rows = await this.db
      .insert(atgAuctionLink)
      .values({ saleId, ...values })
      .onConflictDoUpdate({
        target: atgAuctionLink.saleId,
        set: { ...values, updatedAt: at },
        setWhere: sql`${atgAuctionLink.remoteStatus} NOT IN ('published', 'closed')
          AND (${atgAuctionLink.atgAuctionId} IS NULL OR ${atgAuctionLink.auctionType} = ${settings.auctionType})`,
      })
      .returning({ saleId: atgAuctionLink.saleId });
    return rows.length > 0;
  }
}
