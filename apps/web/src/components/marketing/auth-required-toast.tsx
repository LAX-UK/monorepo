"use client";

import { MarketingQueryToast } from "@/components/marketing/marketing-query-toast";
import Link from "next/link";

export function AuthRequiredToast() {
  return (
    <MarketingQueryToast param="auth" whenValue="required" durationMs={8000}>
      <p className="mb-3 font-body text-sm">Sign in to access your dashboard and place bids.</p>
      <Link
        href="/login?next=/dashboard&auth=required"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary"
      >
        Sign in
      </Link>
    </MarketingQueryToast>
  );
}
