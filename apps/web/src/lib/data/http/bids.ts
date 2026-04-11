import type { BidWriter, PlaceBidInput, PlaceBidResult } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseBid } from "@/lib/data/http/parse";

export function createHttpBidWriter(): BidWriter {
  const client = getBrowserHc();
  return {
    async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
      const res = await client.bids.$post({
        json: {
          auctionId: input.auctionId,
          amount: input.amount,
          ...(input.maxAutoBidAmount !== undefined
            ? { maxAutoBidAmount: input.maxAutoBidAmount }
            : {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
      if (!res.ok) {
        return { ok: false, error: json.error ?? "Could not place bid", status: res.status };
      }
      if (!json.data) {
        return { ok: false, error: "Invalid response", status: res.status };
      }
      return { ok: true, bid: parseBid(json.data) };
    },
  };
}
