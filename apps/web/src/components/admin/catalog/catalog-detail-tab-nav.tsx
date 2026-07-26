"use client";

import type {
  CatalogDetailTabBadge,
  CatalogDetailTabEntityKind,
  CatalogDetailTabSpec,
} from "@/lib/admin/catalog/catalog-detail-tab.types";
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

export type { CatalogDetailTabBadge, CatalogDetailTabEntityKind, CatalogDetailTabSpec };

const TAB_ICONS: Partial<Record<CatalogDetailTabEntityKind, Record<string, LucideIcon>>> = {
  lot: {
    overview: LayoutGrid,
    images: ImageIcon,
    documents: FileText,
    bids: Gavel,
  },
  sale: {
    overview: LayoutGrid,
    schedule: Calendar,
    lots: Package,
    documents: FileText,
    registrations: Users,
    operations: Gavel,
    "telephone-bookings": Users,
    media: ImageIcon,
    press: FileText,
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
  "legal-entity": {
    overview: LayoutGrid,
    documents: FileText,
    compliance: Scale,
    stripe: Building2,
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
  "aria-label": string;
};

function hrefPathname(href: string): string {
  return href.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") ?? href;
}

function resolveActiveTab(tabs: readonly CatalogDetailTabSpec[], pathname: string): string {
  const currentPath = pathname.replace(/\/+$/, "");
  return tabs.find((tab) => hrefPathname(tab.href) === currentPath)?.id ?? tabs[0]?.id ?? "";
}

export function CatalogDetailTabNav({ tabs, entityKind, "aria-label": ariaLabel }: Props) {
  const pathname = usePathname();
  const active = resolveActiveTab(tabs, pathname);

  return (
    <div className="relative border-b border-border-hairline">
      <nav aria-label={ariaLabel}>
        <ul
          className={cn(
            "flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto p-0",
            "snap-x snap-mandatory scrollbar-thin",
            "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]",
            "pr-8",
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
                    "relative inline-flex min-h-11 items-center gap-2.5 border-b-2 px-4 py-2",
                    "font-body text-base font-normal normal-case tracking-normal",
                    isActive
                      ? "border-secondary text-secondary"
                      : "border-transparent text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {Icon ? <Icon className="size-3.5 shrink-0 sm:hidden" aria-hidden /> : null}
                  {tab.label}
                  {tab.count != null && tab.count > 0 ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-label text-xs font-medium tabular-nums",
                        isActive
                          ? "bg-secondary text-on-secondary"
                          : "bg-surface-container-high text-on-surface-variant",
                      )}
                    >
                      {tab.count > 99 ? "99+" : tab.count}
                    </span>
                  ) : null}
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
      <span
        className="pointer-events-none absolute right-0 top-0 hidden h-full w-10 items-center justify-end bg-gradient-to-l from-surface via-surface/80 to-transparent pr-1 sm:flex"
        aria-hidden
      >
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60">
          ···
        </span>
      </span>
    </div>
  );
}
