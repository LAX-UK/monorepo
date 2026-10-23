import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopCertificate,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopRefund,
  shopThirdPartySale,
} from "@auction/db/schema";
import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type {
  PortalPortfolioFacts,
  PortalPortfolioReader,
  PortfolioEditionFact,
  PortfolioOriginalFact,
  PortfolioPendingOrderLineFact,
  PortfolioSaleFact,
  PortfolioWork,
} from "../application/ports/portal-portfolio.reader.js";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { resolvePortalPartyIds } from "./portal-party-ids.js";

const ORIGINAL_SALE_STATUSES = ["deposit_due", "invoiced", "paid", "assigned"] as const;

/** True for the first line of an order, which carries the order's delivery charge. */
const isFirstLineOfOrder = sql<boolean>`${shopOrderLine.id} = (
  SELECT first_line.id FROM shop_order_line first_line
  WHERE first_line.order_id = ${shopOrderLine.orderId}
  ORDER BY first_line.created_at, first_line.id
  LIMIT 1
)`;

async function loadWorks(
  db: Database,
  artworkIds: readonly string[],
): Promise<Map<string, PortfolioWork>> {
  const unique = [...new Set(artworkIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      artworkId: shopArtwork.id,
      slug: shopArtwork.slug,
      title: shopArtwork.title,
      imageKey: shopArtwork.primaryImageUrl,
      channel: shopArtwork.salesChannel,
      artistName: shopParty.displayName,
    })
    .from(shopArtwork)
    .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
    .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
    .where(inArray(shopArtwork.id, unique));
  return new Map(rows.map((row) => [row.artworkId, row]));
}

export function createDrizzlePortalPortfolioRepository(db: Database): PortalPortfolioReader {
  async function listEditions(partyIds: string[], subject: string) {
    return (
      db
        .select({
          editionId: shopEdition.id,
          editionNumber: shopEdition.editionNumber,
          listingStatus: shopEdition.listingStatus,
          createdAt: shopEdition.createdAt,
          artworkId: shopEdition.artworkId,
          hasCertificate: shopArtwork.hasCertificate,
          certificateIssuedAt: shopCertificate.issuedAt,
          orderId: shopOrder.id,
          orderStatus: shopOrder.status,
          orderChannel: shopOrder.salesChannel,
          paidAt: shopOrder.paidAt,
          unitPricePence: shopOrderLine.unitPricePence,
          shippingPence: shopOrder.fulfilmentSurchargePence,
          isFirstLine: isFirstLineOfOrder,
          fulfilmentStatus: shopFulfilment.status,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .leftJoin(
          shopOrderLine,
          and(eq(shopOrderLine.editionId, shopEdition.id), isNull(shopOrderLine.releasedAt)),
        )
        // Only the person's own order counts as their purchase: after a resale the active line
        // still belongs to the original buyer, and must not show that price to the new owner.
        .leftJoin(
          shopOrder,
          and(eq(shopOrder.id, shopOrderLine.orderId), eq(shopOrder.identitySubjectId, subject)),
        )
        .leftJoin(shopFulfilment, eq(shopFulfilment.orderId, shopOrder.id))
        .leftJoin(shopCertificate, eq(shopCertificate.editionId, shopEdition.id))
        .where(inArray(shopEdition.ownerPartyId, partyIds))
        .orderBy(shopArtwork.title, shopEdition.editionNumber)
        .limit(PORTAL_ME_LIST_LIMIT)
    );
  }

  async function listOriginals(partyIds: string[]) {
    return db
      .select({
        originalSaleId: shopOriginalSale.id,
        artworkId: shopOriginalSale.artworkId,
        channel: shopOriginalSale.salesChannel,
        status: shopOriginalSale.status,
        salePricePence: shopOriginalSale.salePricePence,
        updatedAt: shopOriginalSale.updatedAt,
      })
      .from(shopOriginalSale)
      .where(
        and(
          inArray(shopOriginalSale.buyerPartyId, partyIds),
          inArray(shopOriginalSale.status, [...ORIGINAL_SALE_STATUSES]),
        ),
      )
      .orderBy(desc(shopOriginalSale.updatedAt))
      .limit(PORTAL_ME_LIST_LIMIT);
  }

  async function listPendingOrderLines(subject: string) {
    return db
      .select({
        orderLineId: shopOrderLine.id,
        orderId: shopOrderLine.orderId,
        channel: shopOrder.salesChannel,
        artworkId: shopOrderLine.artworkId,
        editionNumber: shopOrderLine.editionNumber,
        unitPricePence: shopOrderLine.unitPricePence,
        shippingPence: shopOrder.fulfilmentSurchargePence,
        isFirstLine: isFirstLineOfOrder,
        createdAt: shopOrderLine.createdAt,
      })
      .from(shopOrder)
      .innerJoin(shopOrderLine, eq(shopOrderLine.orderId, shopOrder.id))
      .where(
        and(
          eq(shopOrder.identitySubjectId, subject),
          eq(shopOrder.status, "pending_payment"),
          or(isNull(shopOrder.checkoutExpiresAt), gt(shopOrder.checkoutExpiresAt, new Date())),
          isNotNull(shopOrderLine.editionId),
          isNull(shopOrderLine.releasedAt),
        ),
      )
      .orderBy(desc(shopOrder.createdAt))
      .limit(PORTAL_ME_LIST_LIMIT);
  }

  async function listSales(partyIds: string[]) {
    return db
      .select({
        payoutId: shopPayoutLedger.id,
        grossPence: shopPayoutLedger.grossPence,
        deductionsPence: shopPayoutLedger.deductionsPence,
        netPence: shopPayoutLedger.netPence,
        status: shopPayoutLedger.status,
        payoutDueAt: shopPayoutLedger.payoutDueAt,
        paidAt: shopPayoutLedger.paidAt,
        createdAt: shopPayoutLedger.createdAt,
        artworkId: sql<
          string | null
        >`coalesce(${shopOrderLine.artworkId}, ${shopEdition.artworkId}, ${shopOriginalSale.artworkId})`,
      })
      .from(shopPayoutLedger)
      .leftJoin(shopOrderLine, eq(shopPayoutLedger.orderLineId, shopOrderLine.id))
      .leftJoin(shopThirdPartySale, eq(shopPayoutLedger.thirdPartySaleId, shopThirdPartySale.id))
      .leftJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
      .leftJoin(shopOriginalSale, eq(shopPayoutLedger.originalSaleId, shopOriginalSale.id))
      .where(inArray(shopPayoutLedger.ownerPartyId, partyIds))
      .orderBy(desc(shopPayoutLedger.createdAt))
      .limit(PORTAL_ME_LIST_LIMIT);
  }

  async function listOrders(subject: string) {
    return db
      .select({
        orderId: shopOrder.id,
        channel: shopOrder.salesChannel,
        status: shopOrder.status,
        totalPence: shopOrder.totalPence,
        paidAt: shopOrder.paidAt,
        createdAt: shopOrder.createdAt,
        checkoutExpiresAt: shopOrder.checkoutExpiresAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.identitySubjectId, subject))
      .orderBy(desc(shopOrder.createdAt))
      .limit(PORTAL_ME_LIST_LIMIT);
  }

  async function listRefunds(subject: string) {
    return db
      .select({
        refundId: shopRefund.id,
        orderId: shopRefund.orderId,
        channel: shopOrder.salesChannel,
        amountPence: shopRefund.amountPence,
        status: shopRefund.status,
        createdAt: shopRefund.createdAt,
      })
      .from(shopRefund)
      .innerJoin(shopOrder, eq(shopRefund.orderId, shopOrder.id))
      .where(eq(shopOrder.identitySubjectId, subject))
      .orderBy(desc(shopRefund.createdAt))
      .limit(PORTAL_ME_LIST_LIMIT);
  }

  return {
    async loadFacts(identitySubjectId, options): Promise<PortalPortfolioFacts> {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      // Orders and refunds belong to the signed-in subject even if they have no party yet.
      const [editionRows, originalRows, pendingRows, saleRows, orders, refunds] = await Promise.all(
        [
          partyIds.length > 0 ? listEditions(partyIds, identitySubjectId) : [],
          partyIds.length > 0 ? listOriginals(partyIds) : [],
          listPendingOrderLines(identitySubjectId),
          partyIds.length > 0 && options.includeSales ? listSales(partyIds) : [],
          listOrders(identitySubjectId),
          listRefunds(identitySubjectId),
        ],
      );

      const works = await loadWorks(db, [
        ...editionRows.map((row) => row.artworkId),
        ...originalRows.map((row) => row.artworkId),
        ...pendingRows.flatMap((row) => (row.artworkId ? [row.artworkId] : [])),
        ...saleRows.flatMap((row) => (row.artworkId ? [row.artworkId] : [])),
      ]);

      const editions = editionRows.flatMap((row): PortfolioEditionFact[] => {
        const work = works.get(row.artworkId);
        if (!work) return [];
        return [
          {
            editionId: row.editionId,
            work,
            editionNumber: row.editionNumber,
            listingStatus: row.listingStatus,
            createdAt: row.createdAt,
            purchase:
              row.orderId && row.orderStatus && row.unitPricePence !== null
                ? {
                    orderId: row.orderId,
                    orderStatus: row.orderStatus,
                    channel: row.orderChannel ?? work.channel,
                    paidAt: row.paidAt,
                    unitPricePence: row.unitPricePence,
                    shippingPence: row.isFirstLine ? (row.shippingPence ?? 0) : 0,
                    fulfilmentStatus: row.fulfilmentStatus,
                  }
                : null,
            certificate: row.certificateIssuedAt
              ? "issued"
              : row.hasCertificate
                ? "expected"
                : "none",
          },
        ];
      });

      const originals = originalRows.flatMap((row): PortfolioOriginalFact[] => {
        const work = works.get(row.artworkId);
        return work
          ? [
              {
                originalSaleId: row.originalSaleId,
                work,
                channel: row.channel,
                status: row.status as PortfolioOriginalFact["status"],
                salePricePence: row.salePricePence,
                updatedAt: row.updatedAt,
              },
            ]
          : [];
      });

      const pendingOrderLines = pendingRows.flatMap((row): PortfolioPendingOrderLineFact[] => {
        const work = row.artworkId ? works.get(row.artworkId) : undefined;
        return work
          ? [
              {
                orderLineId: row.orderLineId,
                orderId: row.orderId,
                channel: row.channel,
                work,
                editionNumber: row.editionNumber,
                unitPricePence: row.unitPricePence,
                shippingPence: row.isFirstLine ? row.shippingPence : 0,
                createdAt: row.createdAt,
              },
            ]
          : [];
      });

      const sales = saleRows.map(
        (row): PortfolioSaleFact => ({
          payoutId: row.payoutId,
          work: row.artworkId ? (works.get(row.artworkId) ?? null) : null,
          grossPence: row.grossPence,
          deductionsPence: row.deductionsPence,
          netPence: row.netPence,
          status: row.status,
          payoutDueAt: row.payoutDueAt,
          paidAt: row.paidAt,
          createdAt: row.createdAt,
        }),
      );

      return { editions, originals, pendingOrderLines, sales, orders, refunds };
    },
  };
}
