import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkInterest } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";

const NOTIFY_ME_BATCH_SIZE = 50;

export async function dispatchShopNotifyMeEmails(
  db: Database,
  input: {
    notifications: ShopNotificationPublisher;
    storefrontUrl: string;
    now: Date;
  },
): Promise<number> {
  const pending = await db
    .select({
      interestId: shopArtworkInterest.id,
      artworkId: shopArtworkInterest.artworkId,
      identitySubjectId: shopArtworkInterest.identitySubjectId,
      artworkSlug: shopArtwork.slug,
      artworkTitle: shopArtwork.title,
    })
    .from(shopArtworkInterest)
    .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
    .where(and(eq(shopArtworkInterest.intent, "notify_me"), isNull(shopArtworkInterest.notifiedAt)))
    .limit(NOTIFY_ME_BATCH_SIZE);

  if (pending.length === 0) return 0;

  const sellable = await sellableCountsByArtworkIds(
    db,
    pending.map((row) => row.artworkId),
  );

  let dispatched = 0;
  for (const row of pending) {
    if ((sellable.get(row.artworkId) ?? 0) <= 0) continue;

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: shopArtworkInterest.id, notifiedAt: shopArtworkInterest.notifiedAt })
        .from(shopArtworkInterest)
        .where(eq(shopArtworkInterest.id, row.interestId))
        .for("update")
        .limit(1);
      if (!locked || locked.notifiedAt) return;

      await input.notifications.queueEditionAvailable(tx as Database, {
        idempotencyKey: `edition-available:${row.interestId}`,
        identitySubjectId: row.identitySubjectId,
        artworkSlug: row.artworkSlug,
        artworkTitle: row.artworkTitle,
        storefrontUrl: input.storefrontUrl,
      });

      await tx
        .update(shopArtworkInterest)
        .set({ notifiedAt: input.now })
        .where(eq(shopArtworkInterest.id, row.interestId));
    });
    dispatched += 1;
  }

  return dispatched;
}
