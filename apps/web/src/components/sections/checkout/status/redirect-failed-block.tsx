"use client";

import { Button } from "@auction/ui/components/button";

type Props = {
  onRetry: () => void;
};

export function RedirectFailedBlock({ onRetry }: Props) {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8"
      aria-live="polite"
    >
      <p className="font-headline text-xl text-on-surface">Could not open Stripe checkout</p>
      <p className="mx-auto mt-3 max-w-md font-body text-sm text-on-surface-variant">
        Your browser may have blocked the redirect. Use the button below to continue securely.
      </p>
      <Button type="button" className="mt-6" onClick={onRetry}>
        Open Stripe checkout
      </Button>
    </output>
  );
}
