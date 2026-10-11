"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import type { AccountChromeState } from "@auction/lax-ecosystem";
import Link from "next/link";

const PILL =
  "art-focus-ring inline-flex min-h-11 items-center rounded-full px-3 font-label text-sm uppercase tracking-wide";

export function ArtAccountStatus({
  account,
  returnTo,
}: {
  account: AccountChromeState;
  returnTo: string;
}) {
  switch (account.kind) {
    case "authenticated":
      return (
        <Link
          href={account.accountHref}
          className={`${PILL} hidden max-w-48 truncate text-on-surface sm:inline-flex`}
        >
          <span className="truncate">{account.displayName ?? "Account"}</span>
        </Link>
      );
    case "disabled":
      return (
        <Link
          href={account.accountHref ?? "/account/disabled"}
          className={`${PILL} text-on-surface`}
        >
          Restricted
        </Link>
      );
    case "unavailable":
      return (
        <span className="hidden text-sm text-on-surface-variant sm:inline" title={account.message}>
          Account unavailable
        </span>
      );
    case "guest":
      return (
        <ArtAuthLink
          href={artStorefrontLoginHref(returnTo)}
          className={`${PILL} border border-outline-variant text-on-surface`}
        >
          Sign in
        </ArtAuthLink>
      );
  }
}
