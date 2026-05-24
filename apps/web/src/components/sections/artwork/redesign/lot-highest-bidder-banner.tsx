import {
  type BidDisplayStatus,
  BidDisplayStatusBanner,
} from "@/components/sections/artwork/bid-display-status-banner";

type Props = {
  status: BidDisplayStatus;
  endedBanner: string | null;
  autoBidActive?: { max: string; step: string | null } | null;
};

/** Promotes winning / owner messaging above the primary CTA; keeps copy in `BidDisplayStatusBanner`.
 */
export function LotHighestBidderBanner({ status, endedBanner, autoBidActive = null }: Props) {
  return (
    <div className="w-full max-w-[550px] space-y-3">
      {endedBanner ? (
        <output
          className="block rounded border border-primary/30 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/20"
          aria-live="polite"
        >
          {endedBanner}
        </output>
      ) : null}
      <BidDisplayStatusBanner status={status} autoBidActive={autoBidActive} />
    </div>
  );
}
