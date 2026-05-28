"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** Minimal mobile wayfinding for verify-identity (not a settings sub-route). */
export function VerifyIdentityMobileNav() {
  return (
    <nav
      aria-label="Verify identity"
      className="sticky top-[var(--header-height-mobile,56px)] z-10 -mx-4 flex min-h-11 items-center gap-3 border-b border-border-hairline bg-surface/95 px-4 py-2 backdrop-blur-sm lg:hidden"
    >
      <Link
        href="/dashboard/settings"
        className="inline-flex min-h-10 items-center gap-1 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Settings
      </Link>
      <span
        className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
        aria-current="page"
      >
        Verify identity
      </span>
    </nav>
  );
}
