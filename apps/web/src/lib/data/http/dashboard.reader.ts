import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import {
  artistFollowRowSchema,
  bidWithLotRowSchema,
  portfolioRowSchema,
  watchlistWithLotRowSchema,
} from "@/lib/data/http/dashboard.schema";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import type { PortfolioRow } from "@auction/types";

export type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";

export async function getServerMyBids(): Promise<BidWithLot[]> {
  const res = await authedServerFetch("/users/me/bids");
  await throwIfNotOk(res, "bids");
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, bidWithLotRowSchema, "GET /users/me/bids");
  return rows;
}

export async function getServerMyPortfolio(): Promise<PortfolioRow[]> {
  const res = await authedServerFetch("/users/me/portfolio");
  await throwIfNotOk(res, "portfolio");
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, portfolioRowSchema, "GET /users/me/portfolio");
  return rows;
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
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, watchlistWithLotRowSchema, "GET /users/me/watchlist");
  return rows;
}

export async function getServerMyArtistFollows(): Promise<ArtistFollowRow[]> {
  const res = await authedServerFetch("/users/me/artist-watchlist");
  await throwIfNotOk(res, "artistFollow");
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, artistFollowRowSchema, "GET /users/me/artist-watchlist");
  return rows;
}
