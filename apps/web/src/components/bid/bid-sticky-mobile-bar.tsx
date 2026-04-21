"use client";

import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  live: boolean;
  decision: BidPolicyDecision;
  loginNextPath: string;
  step: 1 | 2;
  currentPriceLabel: string;
  priceFlash: boolean;
  onScrollToBid: () => void;
};

export function BidStickyMobileBar({
  live,
  decision,
  loginNextPath,
  step,
  currentPriceLabel,
  priceFlash,
  onScrollToBid,
}: Props) {
  if (!live) return null;

  const next = encodeURIComponent(loginNextPath);

  let right: ReactNode;
  if (decision.kind === "block") {
    switch (decision.viewId) {
      case "not-signed-in":
        right = (
          <Link
            href={`/login?next=${next}`}
            className="shrink-0 bg-gradient-to-br from-primary to-primary-container px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-sm"
          >
            Sign in
          </Link>
        );
        break;
      case "admin":
        right = (
          <Link
            href="/admin"
            className="shrink-0 border border-outline-variant/40 px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
          >
            Admin
          </Link>
        );
        break;
      case "seller-own-lot":
      case "suspended":
        right = (
          <span className="shrink-0 px-2 py-3 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">
            {decision.viewId === "seller-own-lot" ? "Your listing" : "Suspended"}
          </span>
        );
        break;
      default:
        right = null;
    }
  } else if (step === 1) {
    right = (
      <button
        type="button"
        onClick={onScrollToBid}
        className="shrink-0 bg-gradient-to-br from-primary to-primary-container px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Place bid
      </button>
    );
  } else {
    right = (
      <button
        type="button"
        onClick={onScrollToBid}
        className="shrink-0 border border-primary/40 px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Confirm bid
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/25 bg-surface-container-lowest/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md lg:hidden dark:border-outline-variant/20 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
            Current bid
          </p>
          <p
            className={`truncate font-headline text-lg text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
          >
            {currentPriceLabel}
          </p>
        </div>
        {right}
      </div>
    </div>
  );
}
