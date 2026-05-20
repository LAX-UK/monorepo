"use client";

import { MarketingQueryToast } from "@/components/marketing/marketing-query-toast";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WelcomeBackToast() {
  const pathname = usePathname();
  const homeHref = pathname.startsWith("/admin") ? "/admin" : "/dashboard";
  const homeLabel = pathname.startsWith("/admin") ? "Admin home" : "Dashboard";

  return (
    <MarketingQueryToast param="welcome" whenValue="back" durationMs={6000}>
      <p className="mb-3 font-body text-sm">You&apos;re signed in. Continue where you left off.</p>
      <Link
        href={homeHref}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
      >
        {homeLabel}
      </Link>
    </MarketingQueryToast>
  );
}
