import { isPlaceholderZone, normaliseViewerZone } from "@auction/datetime";
import type { Database } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type { IRecipientZoneReader } from "../interfaces/recipient-zone.reader.js";

/** Zones already reported as unusable, so a bad saved zone is logged once, not on every run. */
const reportedBadZones = new Set<string>();

/**
 * Reads the Account time zone from the identity directory Bid keeps in step with Account. A saved
 * zone this server cannot compute with is left out, so that person is treated as being in London
 * (as with no saved zone) instead of the bad value failing the 09:00 calculation for everyone.
 */
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
      if (!row.timeZone) continue;
      // UTC and Etc/* name no place: the email shows no local time for them, so no 09:00 either.
      const zone = normaliseViewerZone(row.timeZone);
      if (zone) {
        zones.set(row.subjectId, zone);
      } else if (!isPlaceholderZone(row.timeZone) && !reportedBadZones.has(row.timeZone)) {
        reportedBadZones.add(row.timeZone);
        console.warn(
          `[RecipientZoneReader] unusable saved time zone "${row.timeZone}"; treating as London`,
        );
      }
    }
    return zones;
  }
}
