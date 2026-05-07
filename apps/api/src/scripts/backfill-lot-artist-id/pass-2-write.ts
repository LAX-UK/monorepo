/**
 * Pass 2 — idempotent writes: link lots to resolved artists; create pending artists for text_no_match.
 * Run: `pnpm exec tsx src/scripts/backfill-lot-artist-id/pass-2-write.ts`
 */
import { createDb } from "@auction/db";
import { artistProfile, lot } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  analyzeLotArtistBackfill,
  artistReviewRequiredForStatus,
  fetchArtistStatuses,
  loadAllLotsForBackfill,
} from "./scan.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const db = createDb(url);
  const rows = await loadAllLotsForBackfill(db);
  let updated = 0;
  let createdArtists = 0;

  for (const row of rows) {
    const a = await analyzeLotArtistBackfill(db, row);
    const suggested = a.suggestedArtistId;

    if (a.classification === "clean_artist_profile_id" || a.classification === "clean_text_match") {
      if (!suggested) continue;
      const statusMap = await fetchArtistStatuses(db, [suggested]);
      const flag = artistReviewRequiredForStatus(statusMap.get(suggested));
      const [current] = await db
        .select({ artistId: lot.artistId, artistReviewRequired: lot.artistReviewRequired })
        .from(lot)
        .where(eq(lot.id, row.id))
        .limit(1);
      if (
        current &&
        current.artistId === suggested &&
        current.artistReviewRequired === flag
      ) {
        continue;
      }
      await db
        .update(lot)
        .set({
          artistId: suggested,
          artistReviewRequired: flag,
          updatedAt: new Date(),
        })
        .where(eq(lot.id, row.id));
      updated++;
      continue;
    }

    if (a.classification === "text_no_match" && a.hintText) {
      const hint = a.hintText.trim();
      const baseSlug = slugify(hint) || "artist";
      const uniqueSlug = `${baseSlug}-${row.id.slice(0, 8)}`;
      const newId = randomUUID();
      await db.insert(artistProfile).values({
        id: newId,
        displayName: hint,
        slug: uniqueSlug,
        status: "pending",
      });
      await db
        .update(lot)
        .set({
          artistId: newId,
          artistReviewRequired: true,
          updatedAt: new Date(),
        })
        .where(eq(lot.id, row.id));
      createdArtists++;
      updated++;
    }
  }

  console.log(
    JSON.stringify({ lotsUpdated: updated, pendingArtistsCreated: createdArtists }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
