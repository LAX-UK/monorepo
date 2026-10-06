import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
  shopProduct,
  shopProductVariant,
  shopRefund,
  shopSaleAuthorityGrant,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import type {
  AdminArtistDetail,
  AdminClientDetail,
  AdminOrderDetail,
} from "@auction/shop-contracts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { notFound } from "../errors/shop-api-error.js";
import { listArtistSalesForArtworkIds } from "./shop-artist-sales-query.js";

const CLIENT_KINDS = ["person", "gallery"] as const;

export function createDrizzleAdminDetailReaders(db: Database) {
  return {
    async getClientDetail(partyId: string): Promise<AdminClientDetail> {
      const [party] = await db.select().from(shopParty).where(eq(shopParty.id, partyId)).limit(1);
      if (!party || !CLIENT_KINDS.includes(party.kind as (typeof CLIENT_KINDS)[number])) {
        throw notFound("Client");
      }

      const editions = await db
        .select({
          editionId: shopEdition.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          editionNumber: shopEdition.editionNumber,
          listingStatus: shopEdition.listingStatus,
          custodyStatus: shopEdition.custodyStatus,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .where(eq(shopEdition.ownerPartyId, partyId))
        .orderBy(shopArtwork.title, shopEdition.editionNumber)
        .limit(PORTAL_ME_LIST_LIMIT);

      const ownedArtworkIds = [...new Set(editions.map((row) => row.artworkId))];
      let saleAuthority: AdminClientDetail["saleAuthority"] = [];
      if (ownedArtworkIds.length > 0) {
        const artworks = await db
          .select({
            id: shopArtwork.id,
            slug: shopArtwork.slug,
            title: shopArtwork.title,
          })
          .from(shopArtwork)
          .where(inArray(shopArtwork.id, ownedArtworkIds));

        const editionStats = await db
          .select({
            artworkId: shopEdition.artworkId,
            authorisedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} = 'authorised')`,
            committedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} in ('reserved', 'held', 'sold'))`,
          })
          .from(shopEdition)
          .where(
            and(
              eq(shopEdition.ownerPartyId, partyId),
              inArray(shopEdition.artworkId, ownedArtworkIds),
            ),
          )
          .groupBy(shopEdition.artworkId);

        const latestGrants = await db
          .select({
            artworkId: shopSaleAuthorityGrant.artworkId,
            createdAt: shopSaleAuthorityGrant.createdAt,
            revision: shopSaleAuthorityGrant.revision,
          })
          .from(shopSaleAuthorityGrant)
          .where(
            and(
              eq(shopSaleAuthorityGrant.ownerPartyId, partyId),
              inArray(shopSaleAuthorityGrant.artworkId, ownedArtworkIds),
            ),
          )
          .orderBy(desc(shopSaleAuthorityGrant.revision), desc(shopSaleAuthorityGrant.id));

        const statsByArtwork = new Map(editionStats.map((row) => [row.artworkId, row]));
        const grantAtByArtwork = new Map<string, Date>();
        for (const grant of latestGrants) {
          if (!grantAtByArtwork.has(grant.artworkId)) {
            grantAtByArtwork.set(grant.artworkId, grant.createdAt);
          }
        }

        saleAuthority = artworks.map((artwork) => {
          const stats = statsByArtwork.get(artwork.id);
          const lastGrant = grantAtByArtwork.get(artwork.id);
          return {
            artworkId: artwork.id,
            artworkSlug: artwork.slug,
            artworkTitle: artwork.title,
            authorisedCount: Number(stats?.authorisedCount ?? 0),
            committedCount: Number(stats?.committedCount ?? 0),
            lastGrantAt: lastGrant ? lastGrant.toISOString() : null,
          };
        });
      }

      const requests = await db
        .select({
          requestId: shopSaleAuthorityRequest.id,
          artworkId: shopSaleAuthorityRequest.artworkId,
          artworkTitle: shopArtwork.title,
          requestedCount: shopSaleAuthorityRequest.requestedCount,
          status: shopSaleAuthorityRequest.status,
          createdAt: shopSaleAuthorityRequest.createdAt,
        })
        .from(shopSaleAuthorityRequest)
        .innerJoin(shopArtwork, eq(shopSaleAuthorityRequest.artworkId, shopArtwork.id))
        .where(eq(shopSaleAuthorityRequest.ownerPartyId, partyId))
        .orderBy(desc(shopSaleAuthorityRequest.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      const payouts = await db
        .select()
        .from(shopPayoutLedger)
        .where(eq(shopPayoutLedger.ownerPartyId, partyId))
        .orderBy(desc(shopPayoutLedger.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      return {
        party: {
          partyId: party.id,
          displayName: party.displayName,
          kind: party.kind,
          identitySubjectId: party.identitySubjectId,
          createdAt: party.createdAt.toISOString(),
        },
        editions: editions.map((row) => ({
          editionId: row.editionId,
          artworkId: row.artworkId,
          artworkSlug: row.artworkSlug,
          artworkTitle: row.artworkTitle,
          editionNumber: row.editionNumber,
          listingStatus: row.listingStatus,
          custodyStatus: row.custodyStatus,
        })),
        saleAuthority,
        requests: requests.map((row) => ({
          requestId: row.requestId,
          artworkId: row.artworkId,
          artworkTitle: row.artworkTitle,
          requestedCount: row.requestedCount,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        })),
        payouts: payouts.map((row) => ({
          payoutId: row.id,
          source: row.source,
          grossPence: row.grossPence,
          netPence: row.netPence,
          status: row.status,
          payoutDueAt: row.payoutDueAt.toISOString(),
          paidAt: row.paidAt ? row.paidAt.toISOString() : null,
        })),
      };
    },

    async getArtistDetail(artistId: string): Promise<AdminArtistDetail> {
      const [artistRow] = await db
        .select({
          artistId: shopArtist.id,
          slug: shopArtist.slug,
          discipline: shopArtist.discipline,
          createdAt: shopArtist.createdAt,
          displayName: shopParty.displayName,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.id, artistId))
        .limit(1);
      if (!artistRow) {
        throw notFound("Artist");
      }

      const artworks = await db
        .select({
          artworkId: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
          saleState: shopArtwork.saleState,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.artistId, artistId))
        .orderBy(shopArtwork.title)
        .limit(PORTAL_ME_LIST_LIMIT);

      const artworkIds = artworks.map((row) => row.artworkId);
      let editions: AdminArtistDetail["editions"] = [];
      if (artworkIds.length > 0) {
        const editionRows = await db
          .select({
            editionId: shopEdition.id,
            artworkId: shopEdition.artworkId,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
            listingStatus: shopEdition.listingStatus,
            ownerPartyId: shopEdition.ownerPartyId,
            ownerDisplayName: shopParty.displayName,
          })
          .from(shopEdition)
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .innerJoin(shopParty, eq(shopEdition.ownerPartyId, shopParty.id))
          .where(inArray(shopEdition.artworkId, artworkIds))
          .orderBy(shopArtwork.title, shopEdition.editionNumber)
          .limit(PORTAL_ME_LIST_LIMIT);
        editions = editionRows
          .filter((row): row is typeof row & { ownerPartyId: string } => row.ownerPartyId != null)
          .map((row) => ({
            editionId: row.editionId,
            artworkId: row.artworkId,
            artworkTitle: row.artworkTitle,
            editionNumber: row.editionNumber,
            listingStatus: row.listingStatus,
            ownerPartyId: row.ownerPartyId,
            ownerDisplayName: row.ownerDisplayName,
          }));
      }

      const sales: AdminArtistDetail["sales"] =
        artworkIds.length > 0
          ? (await listArtistSalesForArtworkIds(db, artworkIds, PORTAL_ME_LIST_LIMIT)).map(
              (row) => ({
                saleId: row.saleId,
                channel: row.channel,
                artworkTitle: row.artworkTitle,
                editionNumber: row.editionNumber,
                grossPence: row.grossPence,
                payeeDisplayName: row.payeeDisplayName ?? "",
                occurredAt: row.occurredAt,
              }),
            )
          : [];

      return {
        artist: {
          artistId: artistRow.artistId,
          slug: artistRow.slug,
          displayName: artistRow.displayName,
          discipline: artistRow.discipline,
          createdAt: artistRow.createdAt.toISOString(),
        },
        artworks: artworks.map((row) => ({
          artworkId: row.artworkId,
          slug: row.slug,
          title: row.title,
          saleState: row.saleState,
        })),
        editions,
        sales,
      };
    },

    async getOrderDetail(orderId: string): Promise<AdminOrderDetail> {
      const [order] = await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1);
      if (!order) {
        throw notFound("Order");
      }

      const lines = await db
        .select({
          orderLineId: shopOrderLine.id,
          artworkId: shopOrderLine.artworkId,
          artworkTitle: shopArtwork.title,
          productTitle: shopProduct.title,
          sku: shopProductVariant.sku,
          editionNumber: shopOrderLine.editionNumber,
          unitPricePence: shopOrderLine.unitPricePence,
          sellerPartyId: shopOrderLine.sellerPartyId,
        })
        .from(shopOrderLine)
        .leftJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
        .leftJoin(shopProductVariant, eq(shopOrderLine.productVariantId, shopProductVariant.id))
        .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
        .where(eq(shopOrderLine.orderId, orderId));

      const [fulfilmentRecord] = await db
        .select()
        .from(shopFulfilment)
        .where(eq(shopFulfilment.orderId, orderId))
        .limit(1);

      const refunds = await db
        .select()
        .from(shopRefund)
        .where(eq(shopRefund.orderId, orderId))
        .orderBy(desc(shopRefund.createdAt));

      return {
        orderId: order.id,
        status: order.status,
        fulfilment: order.fulfilment,
        totalPence: order.totalPence,
        buyerSubjectId: order.identitySubjectId,
        stripeCheckoutSessionId: order.stripeCheckoutSessionId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        lines: lines.map((row) => ({
          orderLineId: row.orderLineId,
          artworkId: row.artworkId,
          artworkTitle: row.artworkTitle,
          productTitle: row.productTitle,
          sku: row.sku,
          editionNumber: row.editionNumber,
          unitPricePence: row.unitPricePence,
          sellerPartyId: row.sellerPartyId,
        })),
        fulfilmentRecord: fulfilmentRecord
          ? {
              fulfilmentId: fulfilmentRecord.id,
              status: fulfilmentRecord.status,
              option: fulfilmentRecord.option,
              carrier: fulfilmentRecord.carrier,
              trackingNumber: fulfilmentRecord.trackingNumber,
              updatedAt: fulfilmentRecord.updatedAt.toISOString(),
            }
          : null,
        refunds: refunds.map((row) => ({
          refundId: row.id,
          orderLineId: row.orderLineId,
          amountPence: row.amountPence,
          status: row.status,
          source: row.source,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  };
}
