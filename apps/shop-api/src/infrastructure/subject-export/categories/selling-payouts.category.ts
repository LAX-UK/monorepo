import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopPayoutLedger,
  shopThirdPartySale,
} from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { resolvePortalPartyIds } from "../../portal-party-ids.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, pence, workRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type Origins = SubjectExportDeps["origins"];

export type PayoutLedgerRow = {
  id: string;
  source: "order_line" | "third_party_sale" | "original_sale";
  orderReference: string | null;
  soldAt: Date | null;
  grossPence: number;
  deductionsPence: number;
  netPence: number;
  status: string;
  payoutDueAt: Date;
  paidAt: Date | null;
  paidReference: string | null;
  createdAt: Date;
  artworkId: string | null;
  artworkTitle: string | null;
  artworkSlug: string | null;
  salesChannel: "shop" | "art" | null;
};

/**
 * One sale and its payout. The buyer is identified by the order reference only; the buyer, the
 * broker, who recorded the sale, who paid it and the reasons a payout was held are not selected.
 */
export function mapPayoutLedgerRow(row: PayoutLedgerRow, origins: Origins) {
  return {
    id: `payout:${row.id}`,
    origin: "made_by_us" as const,
    source: row.source,
    orderReference: row.orderReference,
    work:
      row.artworkId && row.artworkTitle
        ? workRef(
            {
              id: row.artworkId,
              title: row.artworkTitle,
              slug: row.artworkSlug,
              salesChannel: row.salesChannel,
            },
            origins,
          )
        : null,
    soldAt: isoRequired(row.soldAt ?? row.createdAt),
    gross: pence(row.grossPence),
    fees: pence(row.deductionsPence),
    net: pence(row.netPence),
    status: row.status,
    dueAt: isoRequired(row.payoutDueAt),
    paidAt: iso(row.paidAt),
    paymentReference: row.paidReference,
  };
}

/**
 * Payouts and the sales behind them, for the parties the person sells as: their own party and the
 * party of their artist profile (the same rule as the seller portal's sales list). A person who
 * never sold has none, and the category is then empty.
 */
export class SellingPayoutsCategory extends SourcedExportCategory {
  readonly id = "selling-payouts";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, origins }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: async (s) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          return partyIds.length === 0
            ? 0
            : countWhere(db, shopPayoutLedger, inArray(shopPayoutLedger.ownerPartyId, partyIds));
        },
        page: async (s, after, limit) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          if (partyIds.length === 0) return [];
          const rows = await db
            .select({
              id: shopPayoutLedger.id,
              source: shopPayoutLedger.source,
              orderReference: shopOrder.reference,
              orderPaidAt: shopOrder.paidAt,
              thirdPartyRecordedAt: shopThirdPartySale.recordedAt,
              originalSaleAt: shopOriginalSale.createdAt,
              grossPence: shopPayoutLedger.grossPence,
              deductionsPence: shopPayoutLedger.deductionsPence,
              netPence: shopPayoutLedger.netPence,
              status: shopPayoutLedger.status,
              payoutDueAt: shopPayoutLedger.payoutDueAt,
              paidAt: shopPayoutLedger.paidAt,
              paidReference: shopPayoutLedger.paidReference,
              createdAt: shopPayoutLedger.createdAt,
              artworkId: shopArtwork.id,
              artworkTitle: shopArtwork.title,
              artworkSlug: shopArtwork.slug,
              salesChannel: shopArtwork.salesChannel,
            })
            .from(shopPayoutLedger)
            .leftJoin(shopOrderLine, eq(shopOrderLine.id, shopPayoutLedger.orderLineId))
            .leftJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
            .leftJoin(
              shopThirdPartySale,
              eq(shopThirdPartySale.id, shopPayoutLedger.thirdPartySaleId),
            )
            .leftJoin(shopEdition, eq(shopEdition.id, shopThirdPartySale.editionId))
            .leftJoin(shopOriginalSale, eq(shopOriginalSale.id, shopPayoutLedger.originalSaleId))
            .leftJoin(
              shopArtwork,
              eq(
                shopArtwork.id,
                sql`coalesce(${shopOrderLine.artworkId}, ${shopEdition.artworkId}, ${shopOriginalSale.artworkId})`,
              ),
            )
            .where(
              and(
                inArray(shopPayoutLedger.ownerPartyId, partyIds),
                afterKey(shopPayoutLedger.id, after),
              ),
            )
            .orderBy(asc(shopPayoutLedger.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapPayoutLedgerRow(
              {
                ...row,
                soldAt: row.orderPaidAt ?? row.thirdPartyRecordedAt ?? row.originalSaleAt,
              },
              origins,
            ),
          }));
        },
      },
    ];
  }
}
