"use client";

import { formatSettlementsContactLine } from "@/lib/checkout/settlements-contact";

type Props = {
  lotTitle: string;
};

export function BankTransferInstructionsBlock({ lotTitle }: Props) {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Bank transfer requested
      </p>
      <p className="font-headline text-2xl text-on-surface">
        Send your transfer to complete payment
      </p>
      <p className="mt-4 font-body text-sm leading-relaxed text-on-surface-variant">
        We&apos;ve set up a UK bank transfer for {lotTitle}. Use the account details and unique
        reference shown by Stripe (also sent to your email) to make the transfer from your bank.
        Payment is not complete until the funds arrive — this page updates automatically when they
        do.
      </p>
      <p className="mt-4 break-all font-body text-sm text-on-surface">
        Need the details again? {formatSettlementsContactLine()}
      </p>
    </output>
  );
}
