"use client";

import { MarketingQueryToast } from "@/components/marketing/marketing-query-toast";
import Link from "next/link";

export function WelcomeBackToast() {
  return (
    <MarketingQueryToast param="welcome" whenValue="back" durationMs={6000}>
      <p className="mb-3 font-body text-sm">You&apos;re signed in. Continue where you left off.</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary"
      >
        Dashboard
      </Link>
    </MarketingQueryToast>
  );
}
