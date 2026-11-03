import { absenteeBid, bid, lot, sale } from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, lotRef, money, saleRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

const CHANNEL: Record<string, string> = {
  web: "online",
  absentee: "online",
  telephone: "telephone",
  saleroom: "room",
};

type LotContext = {
  id: string;
  title: string;
  lotNumber: number | null;
  status: string;
  winnerId: string | null;
  saleId: string | null;
  saleTitle: string | null;
};

/** What became of a bid, judged from the lot it was placed on. */
export function bidOutcome(input: {
  isWinning: boolean;
  lotStatus: string;
  winnerId: string | null;
  subjectId: string;
}): string {
  if (input.lotStatus === "voided" || input.lotStatus === "cancelled") return "void";
  if (input.lotStatus === "ended") return input.winnerId === input.subjectId ? "won" : "outbid";
  return input.isWinning ? "leading" : "outbid";
}

const ABSENTEE_OUTCOME: Record<string, string> = {
  scheduled: "pending",
  executing: "pending",
  lost: "outbid",
  cancelled: "withdrawn",
  voided: "void",
};

function context(lotRow: LotContext, webOrigin: string) {
  return {
    sale: saleRef(
      lotRow.saleId && lotRow.saleTitle ? { id: lotRow.saleId, title: lotRow.saleTitle } : null,
      webOrigin,
    ),
    lot: lotRef(lotRow, webOrigin),
  };
}

/**
 * Only the person's own bids. The lot's current price, the winning bid and every other bidder are
 * never selected, so no other bidder (not even a paddle number) can appear.
 */
export function mapBid(
  row: {
    id: string;
    amount: string;
    maxAutoBidAmount: string | null;
    isWinning: boolean;
    placedVia: string | null;
    createdAt: Date;
    lot: LotContext;
  },
  subjectId: string,
  webOrigin: string,
) {
  return {
    id: row.id,
    origin: "provided" as const,
    placedAt: isoRequired(row.createdAt),
    ...context(row.lot, webOrigin),
    amount: money(row.amount),
    kind: row.maxAutoBidAmount ? "maximum" : "live",
    channel: CHANNEL[row.placedVia ?? "web"] ?? "online",
    outcome: bidOutcome({
      isWinning: row.isWinning,
      lotStatus: row.lot.status,
      winnerId: row.lot.winnerId,
      subjectId,
    }),
  };
}

export function mapAbsenteeBid(
  row: {
    id: string;
    maxAmount: string;
    status: string;
    placedAt: Date;
    lot: LotContext;
  },
  subjectId: string,
  webOrigin: string,
) {
  const settled = row.status === "executed";
  return {
    id: row.id,
    origin: "provided" as const,
    placedAt: isoRequired(row.placedAt),
    ...context(row.lot, webOrigin),
    amount: money(row.maxAmount),
    kind: "maximum",
    channel: "online",
    outcome: settled
      ? bidOutcome({
          isWinning: false,
          lotStatus: row.lot.status,
          winnerId: row.lot.winnerId,
          subjectId,
        })
      : (ABSENTEE_OUTCOME[row.status] ?? row.status),
  };
}

const lotColumns = {
  lotId: lot.id,
  lotTitle: lot.title,
  lotNumber: lot.lotNumber,
  lotStatus: lot.status,
  winnerId: lot.winnerId,
  saleId: sale.id,
  saleTitle: sale.title,
};

function lotContext(row: {
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  lotStatus: string;
  winnerId: string | null;
  saleId: string | null;
  saleTitle: string | null;
}): LotContext {
  return {
    id: row.lotId,
    title: row.lotTitle,
    lotNumber: row.lotNumber,
    status: row.lotStatus,
    winnerId: row.winnerId,
    saleId: row.saleId,
    saleTitle: row.saleTitle,
  };
}

export class BidsCategory extends SourcedExportCategory {
  readonly id = "bids";
  protected readonly sources: readonly ExportSource[];

  constructor(deps: SubjectExportDeps) {
    super();
    const { db, webOrigin } = deps;
    this.sources = [
      {
        count: (s) => countWhere(db, bid, eq(bid.bidderId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: bid.id,
              amount: bid.amount,
              maxAutoBidAmount: bid.maxAutoBidAmount,
              isWinning: bid.isWinning,
              placedVia: bid.placedVia,
              createdAt: bid.createdAt,
              ...lotColumns,
            })
            .from(bid)
            .innerJoin(lot, eq(lot.id, bid.lotId))
            .leftJoin(sale, eq(sale.id, lot.saleId))
            .where(and(eq(bid.bidderId, s), afterKey(bid.id, after)))
            .orderBy(asc(bid.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapBid({ ...row, lot: lotContext(row) }, s, webOrigin),
          }));
        },
      },
      {
        count: (s) => countWhere(db, absenteeBid, eq(absenteeBid.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: absenteeBid.id,
              maxAmount: absenteeBid.maxAmount,
              status: absenteeBid.status,
              placedAt: absenteeBid.placedAt,
              ...lotColumns,
            })
            .from(absenteeBid)
            .innerJoin(lot, eq(lot.id, absenteeBid.lotId))
            .leftJoin(sale, eq(sale.id, lot.saleId))
            .where(and(eq(absenteeBid.userId, s), afterKey(absenteeBid.id, after)))
            .orderBy(asc(absenteeBid.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapAbsenteeBid({ ...row, lot: lotContext(row) }, s, webOrigin),
          }));
        },
      },
    ];
  }
}
