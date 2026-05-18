import type { BidWriter, ListLotsParams, LotReader } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseLot } from "@/lib/data/http/parse";
import type { Lot } from "@auction/types";

function buildQuery(params: ListLotsParams): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.winnerId) q.winnerId = params.winnerId;
  if (params.saleId) q.saleId = params.saleId;
  if (params.endYear !== undefined) q.endYear = String(params.endYear);
  if (params.sort) q.sort = params.sort;
  return q;
}

export function createHttpLotReader(): LotReader {
  const client = getBrowserHc();
  return {
    async list(params: ListLotsParams): Promise<Lot[]> {
      const res = await client.lots.$get({ query: buildQuery(params) });
      if (!res.ok) {
        throw new Error(`Failed to list lots: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown[] };
      return body.data.map(parseLot);
    },
    async getById(id: string): Promise<Lot | null> {
      const res = await client.lots[":id"].$get({ param: { id } });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load lot: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown };
      return parseLot(body.data);
    },
  };
}

export function createHttpBidWriter(): BidWriter {
  const client = getBrowserHc();
  return {
    async placeBid(input) {
      const { trackBidPlaced } = await import("@/lib/analytics/events");
      const marketingEventId =
        trackBidPlaced({
          lotId: input.lotId,
          amount: input.amount,
        }) ?? undefined;
      const res = await client.bids.$post({
        json: {
          lotId: input.lotId,
          amount: input.amount,
          ...(input.maxAutoBidAmount !== undefined
            ? { maxAutoBidAmount: input.maxAutoBidAmount }
            : {}),
          ...(marketingEventId ? { marketingEventId } : {}),
        },
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
      };
      if (!res.ok) {
        return { ok: false, error: body.error ?? "Bid failed", status: res.status };
      }
      return { ok: true, bid: body.data as import("@auction/types").Bid };
    },
  };
}
