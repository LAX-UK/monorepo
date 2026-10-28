import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopDocument,
  shopEdition,
  shopOriginalSale,
  shopPayoutLedger,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  assertOriginalSaleCanAssign,
  assertOriginalSaleCanIssueInvoice,
  assertOriginalSaleCanMarkPaid,
  computePayoutDueAt,
} from "@auction/shop-domain";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { withAdminIdempotency } from "../../application/admin/with-admin-idempotency.js";
import type { InvoiceGateway } from "../../application/ports/invoice.gateway.js";
import type { OriginalSaleWriter } from "../../application/ports/original-sale.writer.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import {
  createDrizzleShopUnitOfWork,
  shopPhaseDbSession,
} from "../drizzle-shop-transaction-effects.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

async function assignOriginalSaleInTransaction(
  tx: Database,
  input: {
    originalSaleId: string;
    domainEventMode: ShopDomainEventPublisherMode;
  },
): Promise<void> {
  const [sale] = await tx
    .select({
      id: shopOriginalSale.id,
      status: shopOriginalSale.status,
      artworkId: shopOriginalSale.artworkId,
      buyerPartyId: shopOriginalSale.buyerPartyId,
      salePricePence: shopOriginalSale.salePricePence,
    })
    .from(shopOriginalSale)
    .where(eq(shopOriginalSale.id, input.originalSaleId))
    .limit(1);
  if (!sale) {
    throw notFound("Original sale");
  }
  assertOriginalSaleCanAssign(sale.status);

  const [artwork] = await tx
    .select({
      id: shopArtwork.id,
      artistId: shopArtwork.artistId,
    })
    .from(shopArtwork)
    .where(eq(shopArtwork.id, sale.artworkId))
    .limit(1);
  if (!artwork) {
    throw notFound("Artwork");
  }

  const [artist] = await tx
    .select({ partyId: shopArtist.partyId })
    .from(shopArtist)
    .where(eq(shopArtist.id, artwork.artistId))
    .limit(1);
  if (!artist?.partyId) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Artist party missing for payout", 500);
  }

  // The buyer's prints sit on the runs made from this original (linked by
  // source_original_artwork_id), or on the original's own row in data from before the Shop and
  // lax.art split. Every buyer print not already given to someone else goes to the buyer.
  const runsOfOriginal = await tx
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.sourceOriginalArtworkId, sale.artworkId));
  const buyerEntitlements = await tx
    .select({ id: shopEdition.id })
    .from(shopEdition)
    .where(
      and(
        inArray(shopEdition.artworkId, [sale.artworkId, ...runsOfOriginal.map((run) => run.id)]),
        eq(shopEdition.allocation, "original_buyer_entitlement"),
        or(isNull(shopEdition.ownerPartyId), eq(shopEdition.ownerPartyId, sale.buyerPartyId)),
      ),
    )
    .orderBy(asc(shopEdition.artworkId), asc(shopEdition.stockRef));

  if (buyerEntitlements.length > 0) {
    await tx
      .update(shopEdition)
      .set({
        ownerPartyId: sale.buyerPartyId,
        listingStatus: "not_authorised",
      })
      .where(
        inArray(
          shopEdition.id,
          buyerEntitlements.map((row) => row.id),
        ),
      );
  }

  await tx
    .update(shopArtwork)
    .set({ saleState: "sold", updatedAt: new Date() })
    .where(eq(shopArtwork.id, sale.artworkId));

  const payoutDueAt = computePayoutDueAt(new Date());
  await tx.insert(shopPayoutLedger).values({
    originalSaleId: sale.id,
    ownerPartyId: artist.partyId,
    grossPence: sale.salePricePence,
    deductionsPence: 0,
    netPence: sale.salePricePence,
    payoutDueAt,
    source: "original_sale",
    payeeKind: "artist",
    status: "due",
    blockedReason: null,
  });

  const documentKey = `original-sales/${sale.id}/purchase-invoice-placeholder.pdf`;
  await tx.insert(shopDocument).values({
    partyId: sale.buyerPartyId,
    kind: "purchase_invoice",
    objectKey: documentKey,
    visibility: "client",
  });

  await tx
    .update(shopOriginalSale)
    .set({ status: "assigned", updatedAt: new Date() })
    .where(eq(shopOriginalSale.id, sale.id));

  void input.domainEventMode;
}

export function createDrizzleOriginalSaleWriter(deps: {
  db: Database;
  uow: ShopUnitOfWorkFactory;
  invoiceGateway: InvoiceGateway;
  domainEventMode: ShopDomainEventPublisherMode;
}): OriginalSaleWriter {
  const { db, uow, invoiceGateway, domainEventMode } = deps;

  return {
    async createReservation(command) {
      return db.transaction(async (tx) => {
        const [row] = await (tx as Database)
          .insert(shopOriginalSale)
          .values({
            artworkId: command.artworkId,
            buyerPartyId: command.buyerPartyId,
            salePricePence: command.salePricePence,
            recordedBySubjectId: command.actorSubjectId,
            status: "reserved",
            ...(command.salesChannel ? { salesChannel: command.salesChannel } : {}),
            ...(command.reservationExpiresAt
              ? { reservationExpiresAt: new Date(command.reservationExpiresAt) }
              : {}),
          })
          .returning({ id: shopOriginalSale.id });
        if (!row) {
          throw new Error("Failed to create original sale reservation");
        }
        const events = createShopDomainEventPublisher(domainEventMode);
        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_original_sale",
          aggregateId: row.id,
          eventType: "shop.original_sale.reserved",
          producer: "shop-api",
          payload: {
            schemaVersion: 1,
            originalSaleId: row.id,
            artworkId: command.artworkId,
          },
        });
        return { originalSaleId: row.id, status: "reserved" as const };
      });
    },

    async issueInvoice(command) {
      return uow.run(async (tx) =>
        withAdminIdempotency({
          tx,
          commandType: "original_sale.issue_invoice",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const session = shopPhaseDbSession(tx);
            const [sale] = await session
              .select({
                id: shopOriginalSale.id,
                status: shopOriginalSale.status,
                salePricePence: shopOriginalSale.salePricePence,
                artworkId: shopOriginalSale.artworkId,
              })
              .from(shopOriginalSale)
              .where(eq(shopOriginalSale.id, command.originalSaleId))
              .limit(1);
            if (!sale) {
              throw notFound("Original sale");
            }
            assertOriginalSaleCanIssueInvoice(sale.status);

            const [artwork] = await session
              .select({ title: shopArtwork.title })
              .from(shopArtwork)
              .where(eq(shopArtwork.id, sale.artworkId))
              .limit(1);

            const invoice = await invoiceGateway.createAndFinalizeOriginalSaleInvoice({
              originalSaleId: sale.id,
              buyerEmail: command.buyerEmail,
              buyerName: command.buyerName,
              description: `Original artwork: ${artwork?.title ?? sale.artworkId}`,
              amountPence: sale.salePricePence,
              currency: "gbp",
              metadata: {
                shop_original_sale_id: sale.id,
                shop_domain: "lax_art",
              },
            });

            await session
              .update(shopOriginalSale)
              .set({
                status: "invoiced",
                stripeInvoiceId: invoice.stripeInvoiceId,
                updatedAt: new Date(),
              })
              .where(eq(shopOriginalSale.id, sale.id));

            return {
              originalSaleId: sale.id,
              status: "invoiced" as const,
              stripeInvoiceId: invoice.stripeInvoiceId,
              hostedInvoiceUrl: invoice.hostedInvoiceUrl,
            };
          },
        }),
      );
    },

    async completePaidAndAssign(command) {
      return db.transaction(async (tx) => {
        const dbTx = tx as Database;
        const [sale] = await dbTx
          .select({
            id: shopOriginalSale.id,
            status: shopOriginalSale.status,
            stripeInvoiceId: shopOriginalSale.stripeInvoiceId,
          })
          .from(shopOriginalSale)
          .where(eq(shopOriginalSale.id, command.originalSaleId))
          .limit(1);
        if (!sale) {
          return { originalSaleId: command.originalSaleId, status: "assigned" as const };
        }
        if (sale.status === "assigned") {
          return { originalSaleId: sale.id, status: "assigned" as const };
        }
        if (sale.stripeInvoiceId && sale.stripeInvoiceId !== command.stripeInvoiceId) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Invoice id does not match original sale",
            409,
          );
        }
        assertOriginalSaleCanMarkPaid(sale.status);

        await dbTx
          .update(shopOriginalSale)
          .set({ status: "paid", updatedAt: command.paidAt })
          .where(eq(shopOriginalSale.id, sale.id));

        await assignOriginalSaleInTransaction(dbTx, {
          originalSaleId: sale.id,
          domainEventMode,
        });

        return { originalSaleId: sale.id, status: "assigned" as const };
      });
    },
  };
}

export async function completeOriginalSaleFromStripeInvoice(
  db: Database,
  input: {
    stripeInvoiceId: string;
    paidAt: Date;
    domainEventMode: ShopDomainEventPublisherMode;
  },
): Promise<"processed" | "ignored" | "duplicate"> {
  const [sale] = await db
    .select({ id: shopOriginalSale.id, status: shopOriginalSale.status })
    .from(shopOriginalSale)
    .where(eq(shopOriginalSale.stripeInvoiceId, input.stripeInvoiceId))
    .limit(1);
  if (!sale) {
    return "ignored";
  }
  if (sale.status === "assigned") {
    return "duplicate";
  }

  await createDrizzleOriginalSaleWriter({
    db,
    uow: createDrizzleShopUnitOfWork(db, input.domainEventMode),
    invoiceGateway: {
      createAndFinalizeOriginalSaleInvoice: async () => {
        throw new Error("unexpected");
      },
    },
    domainEventMode: input.domainEventMode,
  }).completePaidAndAssign({
    originalSaleId: sale.id,
    stripeInvoiceId: input.stripeInvoiceId,
    paidAt: input.paidAt,
  });
  return "processed";
}
