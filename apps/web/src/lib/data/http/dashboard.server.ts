import "server-only";
import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { parseBid, parseLot } from "@/lib/data/http/parse";
import type { ManualReviewReason, PaymentStatus, PortfolioRow } from "@auction/types";

import { authedServerFetch } from "./authed-fetch.server";

export type { ArtistFollowRow, BidWithLot, WatchlistListParams, WatchlistWithLotRow };

export async function getServerMyBids(): Promise<BidWithLot[]> {
  const res = await authedServerFetch("/users/me/bids");
  await throwIfNotOk(res, "bids");
  const body = (await res.json()) as {
    data: Array<{ bid: unknown; lot: unknown | null }>;
  };
  return body.data.map((row) => ({
    bid: parseBid(row.bid),
    lot: row.lot ? parseLot(row.lot) : null,
  }));
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return (
    s === "pending" ||
    s === "authorized" ||
    s === "captured" ||
    s === "refunded" ||
    s === "requires_manual_review"
  );
}

function isManualReviewReason(s: unknown): s is ManualReviewReason {
  return (
    s === "seller_archived" ||
    s === "high_value" ||
    s === "seller_archived_and_high_value" ||
    s === "aml_hold" ||
    s === "source_of_funds_required" ||
    s === "finance_release_required"
  );
}

export async function getServerMyPortfolio(): Promise<PortfolioRow[]> {
  const res = await authedServerFetch("/users/me/portfolio");
  await throwIfNotOk(res, "portfolio");
  const body = (await res.json()) as {
    data: Array<{
      lot: unknown;
      payment: { id: string; status: string; manualReviewReason?: string | null } | null;
    }>;
  };
  return body.data.map((row) => ({
    lot: parseLot(row.lot),
    payment:
      row.payment && isPaymentStatus(row.payment.status)
        ? {
            id: row.payment.id,
            status: row.payment.status,
            manualReviewReason: isManualReviewReason(row.payment.manualReviewReason)
              ? row.payment.manualReviewReason
              : null,
          }
        : null,
  }));
}

export async function getServerMyWatchlist(
  params: WatchlistListParams = {},
): Promise<WatchlistWithLotRow[]> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set("sort", params.sort);
  if (params.status) qs.set("status", params.status);
  if (params.categoryIds?.length) qs.set("categoryIds", params.categoryIds.join(","));
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/users/me/watchlist${suffix}`);
  await throwIfNotOk(res, "watchlist");
  const body = (await res.json()) as {
    data: Array<{
      watchlistId: string;
      lotId: string;
      createdAt: string;
      lot: unknown | null;
    }>;
  };
  return body.data.map((row) => ({
    watchlistId: row.watchlistId,
    lotId: row.lotId,
    createdAt: new Date(row.createdAt),
    lot: row.lot ? parseLot(row.lot) : null,
  }));
}

export async function getServerMyArtistFollows(): Promise<ArtistFollowRow[]> {
  const res = await authedServerFetch("/users/me/artist-watchlist");
  await throwIfNotOk(res, "artistFollow");
  const body = (await res.json()) as {
    data: Array<{ id: string; artistId: string; createdAt: string }>;
  };
  return body.data.map((row) => ({
    watchlistId: row.id,
    artistId: row.artistId,
    createdAt: new Date(row.createdAt),
  }));
}
