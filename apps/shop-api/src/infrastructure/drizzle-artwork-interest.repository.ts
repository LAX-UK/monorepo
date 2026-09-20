import type { Database } from "@auction/db";
import { domainEvent, shopArtwork, shopArtworkInterest } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ArtworkInterestContext,
  ArtworkInterestWriter,
} from "../application/ports/artwork-interest.writer.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { countSellableForArtwork } from "./shop-edition-availability.js";

type ArtworkInterestRepositoryOptions = {
  notifications?: ShopNotificationPublisher;
  enquiryOpsEmail?: string;
};

async function loadArtworkSubscriptionContext(
  db: Database,
  artworkSlug: string,
  forUpdate: boolean,
): Promise<ArtworkInterestContext | null> {
  const query = db
    .select({
      id: shopArtwork.id,
      slug: shopArtwork.slug,
      eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
      printPricePence: shopArtwork.printPricePence,
      saleState: shopArtwork.saleState,
    })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, artworkSlug))
    .limit(1);
  const [row] = forUpdate ? await query.for("update") : await query;
  if (!row) {
    return null;
  }
  const editionsAvailable = await countSellableForArtwork(db, row.id);
  return {
    artworkId: row.id,
    artworkSlug: row.slug,
    eligibleForEditionAllocation: row.eligibleForEditionAllocation,
    printPricePence: row.printPricePence,
    editionsAvailable,
    saleState: row.saleState,
  };
}

export function createDrizzleArtworkInterestRepository(
  db: Database,
  options: ArtworkInterestRepositoryOptions = {},
): ArtworkInterestWriter {
  return {
    loadInterestContext: (artworkSlug) => loadArtworkSubscriptionContext(db, artworkSlug, false),

    async getInterestStatus(input) {
      const interest = await db
        .select({ id: shopArtworkInterest.id })
        .from(shopArtworkInterest)
        .where(
          and(
            eq(shopArtworkInterest.artworkId, input.artworkId),
            eq(shopArtworkInterest.identitySubjectId, input.identitySubjectId),
            eq(shopArtworkInterest.intent, input.intent),
          ),
        )
        .limit(1);
      return { subscribed: interest.length > 0 };
    },

    async registerInterest(input) {
      return db.transaction(async (tx) => {
        const context = await loadArtworkSubscriptionContext(
          tx as Database,
          input.artworkSlug,
          true,
        );
        if (!context || context.artworkId !== input.artworkId) {
          return "not_found";
        }

        const inserted = await tx
          .insert(shopArtworkInterest)
          .values({
            artworkId: input.artworkId,
            identitySubjectId: input.identitySubjectId,
            intent: input.intent,
          })
          .onConflictDoNothing()
          .returning({ id: shopArtworkInterest.id });

        if (inserted.length === 0) {
          return "already_subscribed";
        }

        const interestId = inserted[0]?.id;
        if (!interestId) {
          return "already_subscribed";
        }

        await tx.insert(domainEvent).values({
          aggregateType: "shop_artwork",
          aggregateId: input.artworkId,
          eventType: "shop.artwork.interest_registered",
          payload: {
            artworkId: input.artworkId,
            artworkSlug: input.artworkSlug,
            identitySubjectId: input.identitySubjectId,
            intent: input.intent,
            idempotencyKey: `shop.artwork.interest_registered:${input.artworkId}:${input.identitySubjectId}:${input.intent}`,
          },
          producer: "shop-api",
        });

        if (
          input.intent === "enquiry" &&
          options.notifications &&
          options.enquiryOpsEmail?.trim()
        ) {
          const [artwork] = await tx
            .select({ title: shopArtwork.title })
            .from(shopArtwork)
            .where(eq(shopArtwork.id, input.artworkId))
            .limit(1);
          await options.notifications.queueEnquiryAlert(tx, {
            idempotencyKey: `enquiry:${interestId}`,
            artworkSlug: input.artworkSlug,
            artworkTitle: artwork?.title ?? input.artworkSlug,
            identitySubjectId: input.identitySubjectId,
            opsEmail: options.enquiryOpsEmail.trim(),
          });
        }

        return "registered";
      });
    },
  };
}
