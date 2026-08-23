import { BidBlockerNotice } from "@/components/bid/bid-blocker-notice";
import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import type { BidPolicyDecision } from "./types";

export function blockBid(viewId: string, presentation: BidBlockerPresentation): BidPolicyDecision {
  return {
    kind: "block",
    viewId,
    presentation,
    render: () => <BidBlockerNotice presentation={presentation} />,
  };
}
