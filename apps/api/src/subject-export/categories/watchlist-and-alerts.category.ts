import {
  artistProfile,
  artistWatchlist,
  lot,
  sale,
  saleFollow,
  savedSearch,
  watchlist,
  watchlistReminder,
} from "@auction/db/schema";
import { artistPath } from "@auction/types";
import { and, asc, eq } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, lotRef, money, saleRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export function mapWatchedLot(
  row: {
    id: string;
    createdAt: Date;
    lot: { id: string; title: string; lotNumber: number | null };
  },
  webOrigin: string,
) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "watched_lot",
    target: lotRef(row.lot, webOrigin),
    createdAt: isoRequired(row.createdAt),
  };
}

export function mapFollowedSale(
  row: { id: string; createdAt: Date; sale: { id: string; title: string } },
  webOrigin: string,
) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "followed_sale",
    target: saleRef(row.sale, webOrigin),
    createdAt: isoRequired(row.createdAt),
  };
}

export function mapFollowedArtist(
  row: {
    id: string;
    createdAt: Date;
    artist: { id: string; name: string };
    alertMedium: string | null;
    alertPriceMin: string | null;
    alertPriceMax: string | null;
  },
  webOrigin: string,
) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "followed_artist",
    target: {
      id: row.artist.id,
      title: row.artist.name,
      url: new URL(artistPath(row.artist), webOrigin).toString(),
    },
    query: {
      medium: row.alertMedium,
      priceMin: money(row.alertPriceMin),
      priceMax: money(row.alertPriceMax),
    },
    createdAt: isoRequired(row.createdAt),
  };
}

export function mapSavedSearch(row: {
  id: string;
  label: string;
  query: Record<string, string>;
  notifyEmail: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "saved_search",
    target: { id: row.id, title: row.label },
    query: row.query,
    notifyByEmail: row.notifyEmail,
    createdAt: isoRequired(row.createdAt),
  };
}

export function mapReminder(
  row: {
    id: string;
    reminderKind: string;
    note: string | null;
    updatedAt: Date;
    lot: { id: string; title: string; lotNumber: number | null };
  },
  webOrigin: string,
) {
  return {
    id: `${row.id}:reminder`,
    origin: "provided" as const,
    kind: "reminder",
    target: lotRef(row.lot, webOrigin),
    reminder: row.reminderKind,
    note: row.note,
    // Bid stores when a reminder was last changed, not the moment it fires.
    remindAt: null,
    createdAt: isoRequired(row.updatedAt),
  };
}

export class WatchlistAndAlertsCategory extends SourcedExportCategory {
  readonly id = "watchlist-and-alerts";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, webOrigin }: SubjectExportDeps) {
    super();
    const lotColumns = { lotId: lot.id, lotTitle: lot.title, lotNumber: lot.lotNumber };
    this.sources = [
      {
        count: (s) => countWhere(db, watchlist, eq(watchlist.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({ id: watchlist.id, createdAt: watchlist.createdAt, ...lotColumns })
            .from(watchlist)
            .innerJoin(lot, eq(lot.id, watchlist.lotId))
            .where(and(eq(watchlist.userId, s), afterKey(watchlist.id, after)))
            .orderBy(asc(watchlist.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapWatchedLot(
              { ...row, lot: { id: row.lotId, title: row.lotTitle, lotNumber: row.lotNumber } },
              webOrigin,
            ),
          }));
        },
      },
      {
        count: (s) => countWhere(db, saleFollow, eq(saleFollow.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: saleFollow.id,
              createdAt: saleFollow.createdAt,
              saleId: sale.id,
              saleTitle: sale.title,
            })
            .from(saleFollow)
            .innerJoin(sale, eq(sale.id, saleFollow.saleId))
            .where(and(eq(saleFollow.userId, s), afterKey(saleFollow.id, after)))
            .orderBy(asc(saleFollow.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapFollowedSale(
              { ...row, sale: { id: row.saleId, title: row.saleTitle } },
              webOrigin,
            ),
          }));
        },
      },
      {
        count: (s) => countWhere(db, artistWatchlist, eq(artistWatchlist.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: artistWatchlist.id,
              createdAt: artistWatchlist.createdAt,
              alertMedium: artistWatchlist.alertMedium,
              alertPriceMin: artistWatchlist.alertPriceMin,
              alertPriceMax: artistWatchlist.alertPriceMax,
              artistId: artistProfile.id,
              artistName: artistProfile.displayName,
            })
            .from(artistWatchlist)
            .innerJoin(artistProfile, eq(artistProfile.id, artistWatchlist.artistId))
            .where(and(eq(artistWatchlist.userId, s), afterKey(artistWatchlist.id, after)))
            .orderBy(asc(artistWatchlist.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapFollowedArtist(
              { ...row, artist: { id: row.artistId, name: row.artistName } },
              webOrigin,
            ),
          }));
        },
      },
      {
        count: (s) => countWhere(db, savedSearch, eq(savedSearch.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: savedSearch.id,
              label: savedSearch.label,
              query: savedSearch.query,
              notifyEmail: savedSearch.notifyEmail,
              createdAt: savedSearch.createdAt,
            })
            .from(savedSearch)
            .where(and(eq(savedSearch.userId, s), afterKey(savedSearch.id, after)))
            .orderBy(asc(savedSearch.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapSavedSearch(row) }));
        },
      },
      {
        count: (s) => countWhere(db, watchlistReminder, eq(watchlistReminder.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: watchlistReminder.watchlistId,
              reminderKind: watchlistReminder.kind,
              note: watchlistReminder.note,
              updatedAt: watchlistReminder.updatedAt,
              ...lotColumns,
            })
            .from(watchlistReminder)
            .innerJoin(lot, eq(lot.id, watchlistReminder.lotId))
            .where(
              and(eq(watchlistReminder.userId, s), afterKey(watchlistReminder.watchlistId, after)),
            )
            .orderBy(asc(watchlistReminder.watchlistId))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapReminder(
              { ...row, lot: { id: row.lotId, title: row.lotTitle, lotNumber: row.lotNumber } },
              webOrigin,
            ),
          }));
        },
      },
    ];
  }
}
