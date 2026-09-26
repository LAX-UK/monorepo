"use client";

import { MarketingQueryToast } from "@/components/marketing/marketing-query-toast";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";

export function AuthRequiredToast() {
  return (
    <MarketingQueryToast param="auth" whenValue="required" durationMs={8000}>
      <p className="mb-3 font-body text-sm">Sign in to access your dashboard and place bids.</p>
      <a
        href={buildHostedLoginStartHref({ next: "/dashboard" })}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
      >
        Sign in
      </a>
    </MarketingQueryToast>
  );
}
