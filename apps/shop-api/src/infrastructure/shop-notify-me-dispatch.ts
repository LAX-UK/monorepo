import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkInterest,
  shopEdition,
  shopParty,
} from "@auction/db/schema";
import { and, asc, eq, exists, isNull, sql } from "drizzle-orm";
import { normalizeAlertEmail } from "../application/edition-alert-email.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { type StorefrontOrigins, artworkPublicUrl } from "../domain/storefront-origins.js";
import type { BackInStockLinks } from "./alerts/back-in-stock-links.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";
import { sellableEditionCondition } from "./shop-edition-availability.js";

const NOTIFY_ME_BATCH_SIZE = 50;

/**
 * Emails every waiting edition alert whose edition can be bought again, once. Only alerts for
 * an edition with a sellable copy are picked, so alerts for editions that stay sold out never
 * hold up the batch.
 */
export async function dispatchShopNotifyMeEmails(
  db: Database,
  input: {
    notifications: ShopNotificationPublisher;
    /** The shared alert engine's links: the email's stop link is the engine's, not its own. */
    links: BackInStockLinks;
    storefrontOrigins: StorefrontOrigins;
    now: Date;
  },
): Promise<number> {
  const pending = await db
    .select({
      interestId: shopArtworkInterest.id,
      identitySubjectId: shopArtworkInterest.identitySubjectId,
      contactEmail: shopArtworkInterest.contactEmail,
      artworkSlug: shopArtwork.slug,
      artworkTitle: shopArtwork.title,
      artistName: shopParty.displayName,
      salesChannel: shopArtwork.salesChannel,
    })
    .from(shopArtworkInterest)
    .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
    .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
    .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
    .where(
      and(
        eq(shopArtworkInterest.intent, "notify_me"),
        isNull(shopArtworkInterest.notifiedAt),
        isNull(shopArtworkInterest.cancelledAt),
        exists(
          db
            .select({ one: sql`1` })
            .from(shopEdition)
            .where(and(eq(shopEdition.artworkId, shopArtwork.id), sellableEditionCondition())),
        ),
      ),
    )
    .orderBy(asc(shopArtworkInterest.createdAt), asc(shopArtworkInterest.id))
    .limit(NOTIFY_ME_BATCH_SIZE);

  let dispatched = 0;
  for (const row of pending) {
    // The account's current address wins, so a changed email still gets the alert.
    const accountEmail = row.identitySubjectId
      ? await resolveShopUserEmail(db, row.identitySubjectId)
      : null;
    const to = accountEmail ?? row.contactEmail;

    // The engine decides first: a person who stopped Shop alerts, or this topic, hears nothing.
    const link = to
      ? await input.links.linkFor({ email: to, subjectId: row.identitySubjectId })
      : null;

    const sent = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          notifiedAt: shopArtworkInterest.notifiedAt,
          cancelledAt: shopArtworkInterest.cancelledAt,
        })
        .from(shopArtworkInterest)
        .where(eq(shopArtworkInterest.id, row.interestId))
        .for("update")
        .limit(1);
      if (!locked || locked.notifiedAt || locked.cancelledAt) return false;

      if (!to) {
        // No address to write to: close the alert rather than retry it every run.
        await tx
          .update(shopArtworkInterest)
          .set({ notifiedAt: input.now })
          .where(eq(shopArtworkInterest.id, row.interestId));
        return false;
      }

      if (!link || link.stopped) {
        await tx
          .update(shopArtworkInterest)
          .set({ cancelledAt: input.now, updatedAt: input.now })
          .where(eq(shopArtworkInterest.id, row.interestId));
        return false;
      }

      await input.notifications.queueEditionAvailable(tx as Database, {
        idempotencyKey: `edition-available:${row.interestId}`,
        to,
        artworkSlug: row.artworkSlug,
        artworkTitle: row.artworkTitle,
        artistName: row.artistName,
        artworkUrl: artworkPublicUrl(input.storefrontOrigins, row.salesChannel, row.artworkSlug),
        unsubscribeUrl: link.stopUrl,
        ...(link.manageUrl ? { manageUrl: link.manageUrl } : {}),
      });

      await tx
        .update(shopArtworkInterest)
        .set({
          notifiedAt: input.now,
          // Record the address written to, so a stop reaches every alert waiting for it.
          contactEmail: row.contactEmail ?? normalizeAlertEmail(to),
        })
        .where(eq(shopArtworkInterest.id, row.interestId));
      return true;
    });
    if (sent) dispatched += 1;
  }

  return dispatched;
}
