import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { ReturnedWork } from "@/lib/data/http/workspace-selling.schema";
import { consignAvailability } from "./collection-works";

/** What a "Consign this work" link may start. */
export type ConsignLinkDecision =
  | { kind: "none" }
  | { kind: "lot"; lotId: string }
  | { kind: "submission"; submissionId: string }
  | { kind: "refused"; note: string };

const NOT_YET = "You can consign it once it's paid.";
const NOT_AVAILABLE = "We couldn't start from that work. You can still tell us about it below.";

/**
 * Whether a link may start a consignment from a work. A link is only an address, so it follows
 * the rule the collection uses to offer "Consign this work": the purchase must be paid and not
 * cancelled or refunded, and the member must be allowed to sell. Facts that could not be read
 * refuse the link rather than let it through.
 */
export function decideConsignLink(input: {
  fromLot?: string | undefined;
  fromSubmission?: string | undefined;
  canSell: boolean;
  /** The account's purchases; `null` when they could not be read. */
  purchases: readonly AccountPurchaseFacts[] | null;
  /** The account's works that came back unsold; `null` when they could not be read. */
  returned: readonly ReturnedWork[] | null;
}): ConsignLinkDecision {
  if (input.fromLot) {
    const purchase = input.purchases?.find((p) => p.lotId === input.fromLot);
    if (!purchase) return { kind: "refused", note: NOT_AVAILABLE };
    const { canConsign, note } = consignAvailability({
      canSell: input.canSell,
      purchase: { invoice: purchase.invoice.status, deliveryStage: purchase.delivery.stage },
    });
    return canConsign
      ? { kind: "lot", lotId: input.fromLot }
      : { kind: "refused", note: note ?? NOT_YET };
  }
  if (input.fromSubmission) {
    const work = input.returned?.find((w) => w.submissionId === input.fromSubmission);
    return work?.canConsignAgain && input.canSell
      ? { kind: "submission", submissionId: input.fromSubmission }
      : { kind: "refused", note: NOT_AVAILABLE };
  }
  return { kind: "none" };
}
