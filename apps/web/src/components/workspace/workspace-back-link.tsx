"use client";

import { backTargetOf, buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The way back on a detail page, from 1024px: a quiet link to the parent list, named as the menu
 * names it. Menu pages and tabs have none. On a phone the top bar carries the back arrow.
 */
export function WorkspaceBackLink() {
  const back = backTargetOf(buildClientBreadcrumbTrail(usePathname()));
  if (!back) return null;
  return (
    <nav aria-label="Back" className="hidden lg:mb-4 lg:block">
      <Link
        href={back.href}
        className="lax-focus -ml-1 inline-flex min-h-8 items-center gap-1 rounded-lax-control px-1 text-lax-13 text-lax-muted hover:text-lax-fg"
      >
        <ChevronLeft aria-hidden className="size-3.5" />
        {back.label}
      </Link>
    </nav>
  );
}
