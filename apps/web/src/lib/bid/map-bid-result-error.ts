import { mapBidError } from "@/lib/ui/bid-error";
import type { BidErrorPresentation, MapBidErrorOptions } from "@/lib/ui/bid-error";

export type MapBidResultErrorInput = {
  error: string;
  verifyReturnPath: string;
  lotId?: string;
  code?: string | null;
  saleRegistrationPath?: string | null;
  kycFeedback?: MapBidErrorOptions["kycFeedback"];
};

export function mapBidResultError(input: MapBidResultErrorInput): BidErrorPresentation {
  return mapBidError(input.error, {
    verifyReturnPath: input.verifyReturnPath,
    ...(input.lotId ? { lotId: input.lotId } : {}),
    code: input.code ?? null,
    ...(input.saleRegistrationPath ? { saleRegistrationPath: input.saleRegistrationPath } : {}),
    kycFeedback: input.kycFeedback ?? null,
  });
}
