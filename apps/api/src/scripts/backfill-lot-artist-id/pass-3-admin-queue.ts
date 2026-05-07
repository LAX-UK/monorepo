/**
 * Pass 3 — enqueue admin_review_task rows for unresolved classifications.
 * Run: `pnpm exec tsx src/scripts/backfill-lot-artist-id/pass-3-admin-queue.ts`
 */
import { createDb } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { analyzeLotArtistBackfill, loadAllLotsForBackfill } from "./scan.js";

const NEED_REVIEW = new Set([
  "ambiguous_text",
  "value_is_user_id",
  "corrupt",
]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const db = createDb(url);
  const lots = await loadAllLotsForBackfill(db);
  let inserted = 0;

  for (const row of lots) {
    const a = await analyzeLotArtistBackfill(db, row);
    if (!NEED_REVIEW.has(a.classification)) continue;

    const [existing] = await db
      .select({ id: adminReviewTask.id })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.kind, "lot_artist_backfill"),
          eq(adminReviewTask.targetLotId, row.id),
          eq(adminReviewTask.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) continue;

    await db.insert(adminReviewTask).values({
      kind: "lot_artist_backfill",
      status: "pending",
      targetLotId: row.id,
      payload: {
        classification: a.classification,
        hintText: a.hintText,
        title: row.title,
        currentArtistId: a.currentArtistId,
        marketingSellerArtistId: a.marketingSellerArtistId,
        ambiguityCount: a.ambiguityCount,
      },
    });
    inserted++;
  }

  console.log(JSON.stringify({ tasksInserted: inserted }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
