"use client";

import { AdminEntityTabPanel } from "@/components/admin/admin-entity-tab-panel";
import {
  type DetailQueryTabSpec,
  resolveDetailQueryTab,
} from "@/lib/admin/catalog/detail-tab-compat";
import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

export type CatalogDetailQueryTab = DetailQueryTabSpec & {
  content: ReactNode;
  badgeNode?: ReactNode;
};

function TabContentFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tab">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

type Props = {
  tabs: readonly CatalogDetailQueryTab[];
  defaultTab?: string;
  "aria-label": string;
  className?: string;
};

function CatalogDetailQueryTabsInner({
  tabs,
  defaultTab = "overview",
  "aria-label": ariaLabel,
  className,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const active = resolveDetailQueryTab(urlTab, tabs, defaultTab);

  return (
    <div className={cn("w-full", className)}>
      <div className="sticky top-0 z-20 -mx-px bg-surface/95 backdrop-blur-sm">
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
                const params = new URLSearchParams(searchParams.toString());
                if (tab.id === defaultTab) params.delete("tab");
                else params.set("tab", tab.id);
                const qs = params.toString();
                const href = qs ? `${pathname}?${qs}` : pathname;
                return (
                  <li key={tab.id} className="shrink-0 snap-start">
                    <Link
                      href={href}
                      scroll={false}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative inline-flex min-h-11 items-center gap-2.5 border-b-2 px-4 py-2",
                        "font-body text-base font-normal normal-case tracking-normal",
                        isActive
                          ? "border-secondary text-secondary"
                          : "border-transparent text-on-surface-variant hover:text-on-surface",
                      )}
                    >
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
                      {tab.badgeNode}
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
        </div>
      </div>
      {tabs.map((tab) =>
        tab.id === active ? (
          <div key={tab.id} className="admin-tab-crossfade mt-6 focus-visible:outline-none">
            <Suspense fallback={<TabContentFallback />}>
              <AdminEntityTabPanel>{tab.content}</AdminEntityTabPanel>
            </Suspense>
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Query-param detail tabs styled like CatalogDetailTabNav — preserves `?tab=` bookmarks. */
export function CatalogDetailQueryTabs(props: Props) {
  return (
    <Suspense fallback={<TabContentFallback />}>
      <CatalogDetailQueryTabsInner {...props} />
    </Suspense>
  );
}
