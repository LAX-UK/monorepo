import "server-only";
import type { AuctionReader, ListAuctionsParams } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import { parseAuction, parseBid } from "@/lib/data/http/parse";
import type { Auction, Bid } from "@auction/types";

function buildQuery(params: ListAuctionsParams): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.winnerId) q.winnerId = params.winnerId;
  if (params.sort) q.sort = params.sort;
  return q;
}

/** Initial bid history for artwork SSR (no auth). */
export async function getServerAuctionBids(auctionId: string, limit = 50): Promise<Bid[]> {
  const client = await getServerHc();
  const res = await client.auctions[":id"].bids.$get({
    param: { id: auctionId },
    query: { limit: String(limit) },
  });
  if (!res.ok) {
    throw new Error(`Failed to load bids: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseBid);
}

export async function getServerAuctionReader(): Promise<AuctionReader> {
  const client = await getServerHc();
  return {
    async list(params: ListAuctionsParams): Promise<Auction[]> {
      const res = await client.auctions.$get({ query: buildQuery(params) });
      if (!res.ok) {
        throw new Error(`Failed to list auctions: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown[] };
      return body.data.map(parseAuction);
    },
    async getById(id: string): Promise<Auction | null> {
      const res = await client.auctions[":id"].$get({ param: { id } });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load auction: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown };
      return parseAuction(body.data);
    },
  };
}
