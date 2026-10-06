import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopPayoutLedger,
  shopThirdPartySale,
} from "@auction/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type { PortalSalesReader } from "../application/ports/portal-ownership.reader.js";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { resolvePortalPartyIds } from "./portal-party-ids.js";

export function createDrizzlePortalSalesRepository(db: Database): PortalSalesReader {
  return {
    async listSales(identitySubjectId: string) {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
        return [];
      }
      const ledgerRows = await db
        .select()
        .from(shopPayoutLedger)
        .where(inArray(shopPayoutLedger.ownerPartyId, partyIds))
        .orderBy(desc(shopPayoutLedger.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      const orderLineIds = ledgerRows
        .filter((p) => p.source === "order_line" && p.orderLineId)
        .map((p) => p.orderLineId as string);
      const thirdPartySaleIds = ledgerRows
        .filter((p) => p.source === "third_party_sale" && p.thirdPartySaleId)
        .map((p) => p.thirdPartySaleId as string);
      const originalSaleIds = ledgerRows
        .filter((p) => p.source === "original_sale" && p.originalSaleId)
        .map((p) => p.originalSaleId as string);

      const orderLineById = new Map<
        string,
        {
          orderLineId: string;
          artworkId: string;
          artworkSlug: string;
          artworkTitle: string;
          editionNumber: number | null;
          paidAt: Date | null;
        }
      >();
      if (orderLineIds.length > 0) {
        const orderLineRows = await db
          .select({
            orderLineId: shopOrderLine.id,
            artworkId: shopArtwork.id,
            artworkSlug: shopArtwork.slug,
            artworkTitle: shopArtwork.title,
            editionNumber: shopOrderLine.editionNumber,
            paidAt: shopOrder.paidAt,
          })
          .from(shopOrderLine)
          .innerJoin(shopOrder, eq(shopOrderLine.orderId, shopOrder.id))
          .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
          .where(inArray(shopOrderLine.id, orderLineIds));
        for (const row of orderLineRows) {
          orderLineById.set(row.orderLineId, row);
        }
      }

      const thirdPartyById = new Map<
        string,
        {
          saleId: string;
          artworkId: string;
          artworkSlug: string;
          artworkTitle: string;
          editionNumber: number;
          recordedAt: Date | null;
        }
      >();
      if (thirdPartySaleIds.length > 0) {
        const thirdPartyRows = await db
          .select({
            saleId: shopThirdPartySale.id,
            artworkId: shopArtwork.id,
            artworkSlug: shopArtwork.slug,
            artworkTitle: shopArtwork.title,
            editionNumber: shopEdition.editionNumber,
            recordedAt: shopThirdPartySale.recordedAt,
          })
          .from(shopThirdPartySale)
          .innerJoin(shopEdition, eq(shopThirdPartySale.editionId, shopEdition.id))
          .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
          .where(inArray(shopThirdPartySale.id, thirdPartySaleIds));
        for (const row of thirdPartyRows) {
          thirdPartyById.set(row.saleId, row);
        }
      }

      const originalById = new Map<
        string,
        {
          saleId: string;
          artworkId: string;
          artworkSlug: string;
          artworkTitle: string;
          createdAt: Date;
        }
      >();
      if (originalSaleIds.length > 0) {
        const originalRows = await db
          .select({
            saleId: shopOriginalSale.id,
            artworkId: shopArtwork.id,
            artworkSlug: shopArtwork.slug,
            artworkTitle: shopArtwork.title,
            createdAt: shopOriginalSale.createdAt,
          })
          .from(shopOriginalSale)
          .innerJoin(shopArtwork, eq(shopOriginalSale.artworkId, shopArtwork.id))
          .where(inArray(shopOriginalSale.id, originalSaleIds));
        for (const row of originalRows) {
          originalById.set(row.saleId, row);
        }
      }

      const statements = [];
      for (const payout of ledgerRows) {
        if (payout.source === "order_line" && payout.orderLineId) {
          const row = orderLineById.get(payout.orderLineId);
          if (!row) continue;
          statements.push({
            saleId: row.orderLineId,
            channel: "direct" as const,
            artworkId: row.artworkId,
            artworkSlug: row.artworkSlug,
            artworkTitle: row.artworkTitle,
            editionNumber: row.editionNumber,
            soldAt: (row.paidAt ?? payout.createdAt).toISOString(),
            grossPence: payout.grossPence,
            feesPence: payout.deductionsPence,
            netPence: payout.netPence,
            payoutId: payout.id,
            payoutStatus: payout.status,
          });
        } else if (payout.source === "third_party_sale" && payout.thirdPartySaleId) {
          const row = thirdPartyById.get(payout.thirdPartySaleId);
          if (!row) continue;
          statements.push({
            saleId: row.saleId,
            channel: "third_party" as const,
            artworkId: row.artworkId,
            artworkSlug: row.artworkSlug,
            artworkTitle: row.artworkTitle,
            editionNumber: row.editionNumber,
            soldAt: (row.recordedAt ?? payout.createdAt).toISOString(),
            grossPence: payout.grossPence,
            feesPence: payout.deductionsPence,
            netPence: payout.netPence,
            payoutId: payout.id,
            payoutStatus: payout.status,
          });
        } else if (payout.source === "original_sale" && payout.originalSaleId) {
          const row = originalById.get(payout.originalSaleId);
          if (!row) continue;
          statements.push({
            saleId: row.saleId,
            channel: "original" as const,
            artworkId: row.artworkId,
            artworkSlug: row.artworkSlug,
            artworkTitle: row.artworkTitle,
            editionNumber: null,
            soldAt: row.createdAt.toISOString(),
            grossPence: payout.grossPence,
            feesPence: payout.deductionsPence,
            netPence: payout.netPence,
            payoutId: payout.id,
            payoutStatus: payout.status,
          });
        }
      }
      return statements;
    },
  };
}
