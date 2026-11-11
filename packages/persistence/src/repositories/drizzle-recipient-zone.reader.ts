import type { Database } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type { IRecipientZoneReader } from "../interfaces/recipient-zone.reader.js";

/** Reads the Account time zone from the identity directory Bid keeps in step with Account. */
export class DrizzleRecipientZoneReader implements IRecipientZoneReader {
  constructor(private readonly db: Database) {}

  async zonesFor(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const zones = new Map<string, string>();
    if (userIds.length === 0) return zones;
    const rows = await this.db
      .select({
        subjectId: bidIdentityDirectory.subjectId,
        timeZone: bidIdentityDirectory.timeZone,
      })
      .from(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, [...userIds]));
    for (const row of rows) {
      if (row.timeZone) zones.set(row.subjectId, row.timeZone);
    }
    return zones;
  }
}
