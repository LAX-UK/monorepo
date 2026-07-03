"use client";

type Props = {
  lotTitle: string;
};

export function RedirectingToStripeBlock({ lotTitle }: Props) {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Secure checkout
      </p>
      <p className="font-headline text-2xl text-on-surface">Opening Stripe checkout…</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Taking you to pay for {lotTitle}. This may take a few seconds.
      </p>
    </output>
  );
}
