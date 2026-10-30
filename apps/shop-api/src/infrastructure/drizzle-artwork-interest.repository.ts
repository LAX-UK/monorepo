import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkInterest } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { enquirySenderColumns } from "../application/enquiry-sender.js";
import type {
  ArtworkInterestContext,
  ArtworkInterestWriter,
} from "../application/ports/artwork-interest.writer.js";
import type { EnquiryFollowUp } from "../application/ports/enquiry-follow-up.js";
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
  /** The lead and the sender's copy, after an enquiry is stored. */
  followUp?: EnquiryFollowUp;
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

/** An account's earlier enquiry about the same work, which a repeat enquiry points back to. */
async function existingEnquiryReference(
  db: Database,
  input: { artworkId: string; sender: { kind: string; identitySubjectId?: string } },
): Promise<string | null> {
  if (input.sender.kind !== "account" || !input.sender.identitySubjectId) return null;
  const [row] = await db
    .select({ reference: shopArtworkInterest.reference })
    .from(shopArtworkInterest)
    .where(
      and(
        eq(shopArtworkInterest.artworkId, input.artworkId),
        eq(shopArtworkInterest.identitySubjectId, input.sender.identitySubjectId),
        eq(shopArtworkInterest.intent, "enquiry"),
      ),
    )
    .limit(1);
  return row?.reference ?? null;
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
            // A sent or stopped alert is over; only a waiting one counts as subscribed.
            ...(input.intent === "notify_me"
              ? [isNull(shopArtworkInterest.notifiedAt), isNull(shopArtworkInterest.cancelledAt)]
              : []),
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
          return { status: "not_found" as const };
        }

        const isEnquiry = input.intent === "enquiry";
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
          .returning({ id: shopArtworkInterest.id, reference: shopArtworkInterest.reference });

        const stored = inserted[0];
        if (!stored) {
          return {
            status: "already_subscribed" as const,
            reference: isEnquiry ? await existingEnquiryReference(tx as Database, input) : null,
          };
        }
        const interestId = stored.id;

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

        if (!isEnquiry || !stored.reference) {
          return { status: "registered" as const, reference: null };
        }
        const [artwork] = await tx
          .select({ title: shopArtwork.title })
          .from(shopArtwork)
          .where(eq(shopArtwork.id, input.artworkId))
          .limit(1);
        const artworkTitle = artwork?.title ?? input.artworkSlug;
        const artworkUrl = artworkPublicUrl(
          storefrontOrigins,
          input.salesChannel,
          input.artworkSlug,
        );
        if (options.notifications && options.enquiryOpsEmail?.trim()) {
          await options.notifications.queueEnquiryAlert(tx, {
            idempotencyKey: `enquiry:${interestId}`,
            artworkSlug: input.artworkSlug,
            artworkTitle,
            artworkUrl,
            sender: input.sender,
            opsEmail: options.enquiryOpsEmail.trim(),
            salesChannel: input.salesChannel,
            ...(input.message ? { message: input.message } : {}),
            ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
          });
        }
        await options.followUp?.afterStored(
          tx,
          {
            reference: stored.reference,
            sender: input.sender,
            phone: input.contactPhone ?? null,
            salesChannel: input.salesChannel,
            topic: "artwork",
            artworkTitle,
            artworkUrl,
          },
          new Date(),
        );

        return { status: "registered" as const, reference: stored.reference };
      });
    },
  };
}
