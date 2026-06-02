"use client";

import { parseArtistDetailTabFromPath } from "@/components/admin/artist-detail/artist-detail-types";
import { parseCategoryDetailTabFromPath } from "@/components/admin/category-detail/category-detail-types";
import { parseLotDetailTabFromPath } from "@/components/admin/lot-detail/lot-detail-types";
import { parseSaleDetailTabFromPath } from "@/components/admin/sale-detail/sale-detail-types";
import { parseSubmissionDetailTabFromPath } from "@/components/admin/submission-detail/submission-detail-types";
import { parseVenueDetailTabFromPath } from "@/components/admin/venue-detail/venue-detail-types";
import { cn } from "@auction/ui";
import {
  Activity,
  Building2,
  Calendar,
  Copy,
  FileText,
  Gavel,
  GitMerge,
  ImageIcon,
  LayoutGrid,
  type LucideIcon,
  Package,
  Scale,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type CatalogDetailTabBadge = "pending" | "warning" | "default";

export type CatalogDetailTabEntityKind =
  | "lot"
  | "sale"
  | "category"
  | "artist"
  | "submission"
  | "venue";

export type CatalogDetailTabSpec = {
  id: string;
  label: ReactNode;
  href: string;
  badge?: CatalogDetailTabBadge;
};

const TAB_ICONS: Partial<Record<CatalogDetailTabEntityKind, Record<string, LucideIcon>>> = {
  lot: {
    overview: LayoutGrid,
    images: ImageIcon,
    documents: FileText,
    bids: Gavel,
    activity: Activity,
  },
  sale: {
    overview: LayoutGrid,
    schedule: Calendar,
    lots: Package,
    documents: FileText,
    registrations: Users,
    activity: Activity,
  },
  category: {
    overview: LayoutGrid,
    children: Copy,
    lots: Package,
    sales: Building2,
    activity: Activity,
  },
  artist: {
    overview: LayoutGrid,
    lots: Package,
    duplicates: GitMerge,
    review: Scale,
  },
  submission: {
    overview: LayoutGrid,
    documents: FileText,
    decision: Scale,
  },
  venue: {
    overview: LayoutGrid,
    sales: Package,
    activity: Activity,
  },
};

function tabIcon(entityKind: CatalogDetailTabEntityKind, tabId: string): LucideIcon | undefined {
  return TAB_ICONS[entityKind]?.[tabId];
}

type Props = {
  tabs: readonly CatalogDetailTabSpec[];
  entityKind: CatalogDetailTabEntityKind;
  entityId: string;
  "aria-label": string;
};

function resolveActiveTab(
  entityKind: CatalogDetailTabEntityKind,
  entityId: string,
  pathname: string,
): string {
  switch (entityKind) {
    case "lot":
      return parseLotDetailTabFromPath(pathname, entityId);
    case "sale":
      return parseSaleDetailTabFromPath(pathname, entityId);
    case "category":
      return parseCategoryDetailTabFromPath(pathname, entityId);
    case "artist":
      return parseArtistDetailTabFromPath(pathname, entityId);
    case "submission":
      return parseSubmissionDetailTabFromPath(pathname, entityId);
    case "venue":
      return parseVenueDetailTabFromPath(pathname, entityId);
  }
}

export function CatalogDetailTabNav({
  tabs,
  entityKind,
  entityId,
  "aria-label": ariaLabel,
}: Props) {
  const pathname = usePathname();
  const active = resolveActiveTab(entityKind, entityId, pathname);

  return (
    <nav aria-label={ariaLabel} className="border-b border-border-hairline">
      <ul
        className={cn(
          "flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto p-0",
          "snap-x snap-mandatory scrollbar-thin",
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tabIcon(entityKind, tab.id);
          return (
            <li key={tab.id} className="shrink-0 snap-start">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-2.5",
                  "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                  isActive
                    ? "border-primary text-on-surface"
                    : "border-transparent text-on-surface-variant hover:text-on-surface",
                )}
              >
                {Icon ? <Icon className="size-3.5 shrink-0 sm:hidden" aria-hidden /> : null}
                {tab.label}
                {tab.badge === "pending" ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-warning"
                    aria-label="Pending"
                  />
                ) : null}
                {tab.badge === "warning" ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-danger"
                    aria-label="Attention needed"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
