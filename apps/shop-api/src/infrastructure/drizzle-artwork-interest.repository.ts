import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkInterest } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { enquirySenderColumns } from "../application/enquiry-sender.js";
import type {
  ArtworkInterestContext,
  ArtworkInterestWriter,
} from "../application/ports/artwork-interest.writer.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { type StorefrontOrigins, artworkPublicUrl } from "../domain/storefront-origins.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "./shop-domain-event-publisher.js";
import { countSellableForArtwork } from "./shop-edition-availability.js";

type ArtworkInterestRepositoryOptions = {
  notifications?: ShopNotificationPublisher;
  storefrontOrigins?: StorefrontOrigins;
  enquiryOpsEmail?: string;
  domainEventMode?: ShopDomainEventPublisherMode;
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
      salesChannel: shopArtwork.salesChannel,
    })
    .from(shopArtwork)
    .where(and(eq(shopArtwork.slug, artworkSlug), publicArtworkVisible()))
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
    salesChannel: row.salesChannel,
  };
}

const DEFAULT_STOREFRONT_ORIGINS: StorefrontOrigins = {
  shop: "http://localhost:3020",
  art: "http://localhost:3050",
};

export function createDrizzleArtworkInterestRepository(
  db: Database,
  options: ArtworkInterestRepositoryOptions = {},
): ArtworkInterestWriter {
  const storefrontOrigins = options.storefrontOrigins ?? DEFAULT_STOREFRONT_ORIGINS;
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
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
            ...enquirySenderColumns(input.sender),
            intent: input.intent,
            ...(input.intent === "enquiry" && input.message ? { message: input.message } : {}),
            ...(input.intent === "enquiry" && input.contactPhone
              ? { contactPhone: input.contactPhone }
              : {}),
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

        // The event feeds account-keyed consumers (CRM deals); guests reach staff by the alert only.
        if (input.sender.kind === "account") {
          await events.insertInTransaction(tx as Database, {
            aggregateType: "shop_artwork",
            aggregateId: input.artworkId,
            eventType: "shop.artwork.interest_registered",
            producer: "shop-api",
            payload: {
              schemaVersion: 1,
              artworkId: input.artworkId,
              identitySubjectId: input.sender.identitySubjectId,
              intent: input.intent,
            },
          });
        }

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
            artworkUrl: artworkPublicUrl(storefrontOrigins, input.salesChannel, input.artworkSlug),
            sender: input.sender,
            opsEmail: options.enquiryOpsEmail.trim(),
            salesChannel: input.salesChannel,
            ...(input.message ? { message: input.message } : {}),
            ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
          });
        }

        return "registered";
      });
    },
  };
}
