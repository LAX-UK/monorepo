"use client";

import { ShieldCheck, Truck, VerifiedIcon } from "lucide-react";

export function TrustBadges() {
  return (
    <ul className="flex min-w-0 flex-col gap-3 border-y border-border-hairline py-5 font-label text-xs font-bold text-on-surface-variant sm:flex-row sm:flex-wrap sm:gap-x-6">
      <li className="inline-flex min-w-0 items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <span>Payment protection</span>
      </li>
      <li className="inline-flex min-w-0 items-center gap-2">
        <VerifiedIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span>Certificate included</span>
      </li>
      <li className="inline-flex min-w-0 items-center gap-2">
        <Truck className="size-4 shrink-0 text-primary" aria-hidden />
        <span>Insured shipping</span>
      </li>
    </ul>
  );
}
