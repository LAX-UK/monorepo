import { BidErrorView } from "@/components/bid/bid-error-view";
import { formatMoney } from "@/lib/format-currency";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  amount: string;
  maxAuto: string | null;
  autoBidStep?: string | null;
  error: BidErrorPresentation | null;
  submitting: boolean;
  biddingDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BidConfirmation({
  amount,
  maxAuto,
  autoBidStep = null,
  error,
  submitting,
  biddingDisabled = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="border-l-4 border-primary bg-surface-container-high/60 p-6 ring-1 ring-outline-variant/10">
        <dl className="space-y-4">
          <div>
            <dt className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              This bid
            </dt>
            <dd className="font-headline text-3xl text-primary">{formatMoney(amount)}</dd>
          </div>
          {maxAuto ? (
            <div className="border-t border-outline-variant/20 pt-4">
              <dt className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                Auto-bid max (stays active)
              </dt>
              <dd className="mt-1 font-headline text-xl text-on-surface">{formatMoney(maxAuto)}</dd>
              {autoBidStep ? (
                <p className="mt-2 font-body text-sm text-on-surface-variant">
                  Raises by {formatMoney(autoBidStep)} each time you&apos;re outbid, until your max
                  is reached.
                </p>
              ) : (
                <p className="mt-2 font-body text-sm text-on-surface-variant">
                  We&apos;ll keep defending after this bid until your max is reached.
                </p>
              )}
            </div>
          ) : null}
        </dl>
        <p className="mt-4 font-label text-xs leading-relaxed text-on-surface-variant">
          By placing a bid you agree to the{" "}
          <Link href="/terms" className="text-primary underline-offset-2 hover:underline">
            terms of sale
          </Link>
          .
        </p>
      </div>
      <BidErrorView error={error} />
      <div className="flex gap-4">
        <Button type="button" variant="secondaryOutline" className="flex-1 py-6" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1 py-6"
          disabled={submitting || biddingDisabled}
          onClick={() => void onConfirm()}
        >
          {submitting ? "Submitting…" : "Place bid"}
        </Button>
      </div>
    </div>
  );
}
