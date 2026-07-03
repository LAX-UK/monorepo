"use client";

export function PaymentInFlightBlock() {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Payment in progress
      </p>
      <p className="font-headline text-2xl text-on-surface">Bank transfer processing</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Your UK bank transfer is in flight. This page updates automatically when payment is
        confirmed — no need to pay again.
      </p>
    </output>
  );
}
