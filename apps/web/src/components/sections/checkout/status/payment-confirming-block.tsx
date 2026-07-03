"use client";

import { formatSettlementsContactLine } from "@/lib/checkout/settlements-contact";
import { Button } from "@auction/ui/components/button";

type Props = {
  lotTitle: string;
  timedOut: boolean;
  onRefresh: () => void;
};

export function PaymentConfirmingBlock({ lotTitle, timedOut, onRefresh }: Props) {
  if (timedOut) {
    return (
      <output
        className="block rounded-xl border border-warning/40 bg-warning-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
        aria-live="polite"
      >
        <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Still confirming
        </p>
        <p className="font-headline text-2xl text-on-surface">
          Your payment is taking longer than expected
        </p>
        <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
          Stripe received your payment for {lotTitle} but confirmation has not arrived yet. This can
          take a few minutes. Refresh to check again, or contact settlements if it persists — please
          do not pay again.
        </p>
        <p className="mt-3 break-all font-body text-sm text-on-surface">
          {formatSettlementsContactLine()}
        </p>
        <Button type="button" variant="secondaryOutline" className="mt-6" onClick={onRefresh}>
          Refresh status
        </Button>
      </output>
    );
  }
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Confirming payment
      </p>
      <p className="font-headline text-2xl text-on-surface">Thank you — processing your payment</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Stripe has received your payment for {lotTitle}. This page updates automatically when
        confirmation is complete — please do not pay again.
      </p>
    </output>
  );
}
