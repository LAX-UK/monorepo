import { clientBidError } from "@/lib/ui/bid-error";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";

export type RefreshBeforeSubmitInput = {
  biddingLive: boolean;
  biddingAllowed: boolean;
  realtimeHealthy: boolean;
  refresh: () => Promise<{ ok: boolean }>;
};

export type RefreshBeforeSubmitResult = { ok: true } | { ok: false; error: BidErrorPresentation };

export async function refreshBeforeSubmitIfNeeded(
  input: RefreshBeforeSubmitInput,
): Promise<RefreshBeforeSubmitResult> {
  if (input.biddingLive && input.biddingAllowed && !input.realtimeHealthy) {
    const refreshed = await input.refresh();
    if (!refreshed.ok) {
      return {
        ok: false,
        error: clientBidError(
          "Could not refresh live prices. Check your connection and try again.",
        ),
      };
    }
  }
  return { ok: true };
}
