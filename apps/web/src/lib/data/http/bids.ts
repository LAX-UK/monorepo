import type { BidWriter, PlaceBidInput, PlaceBidResult } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseBid } from "@/lib/data/http/parse";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";

export function createHttpBidWriter(): BidWriter {
  const client = getBrowserHc();
  return {
    async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
      const res = await client.bids.$post({
        json: {
          lotId: input.lotId,
          amount: input.amount,
          ...(input.maxAutoBidAmount !== undefined
            ? { maxAutoBidAmount: input.maxAutoBidAmount }
            : {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
        summary?: {
          feedback?: {
            headline: string;
            detail: string | null;
            needsResubmit: boolean;
            action: "start" | "continue" | "retry" | "wait" | "none";
          };
        };
      };
      if (!res.ok) {
        const errMsg = json.error ?? "Could not place bid";
        notifyAdminCannotBuyIfNeeded(json.error, res.status);
        return {
          ok: false,
          error: errMsg,
          status: res.status,
          kycFeedback: json.summary?.feedback ?? null,
        };
      }
      if (!json.data) {
        return { ok: false, error: "Invalid response", status: res.status };
      }
      return { ok: true, bid: parseBid(json.data) };
    },
  };
}
