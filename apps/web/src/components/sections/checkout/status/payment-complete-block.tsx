"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export function PaymentCompleteBlock() {
  return (
    <output className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10">
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Payment recorded
      </p>
      <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Your payment is on file. Track fulfilment above and view this lot in your collection.
      </p>
      <Button asChild variant="secondaryOutline" className="mt-6">
        <Link href="/dashboard/portfolio">View collection</Link>
      </Button>
    </output>
  );
}
