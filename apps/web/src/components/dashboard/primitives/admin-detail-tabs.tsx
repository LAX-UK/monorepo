"use client";

import { adminDetailTabsStickyTop } from "@/lib/admin/admin-sticky-layout";
import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useState } from "react";

function TabContentFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tab">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export type AdminDetailTab = {
  value: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
};

/** Legacy query-tab ids kept for deep-link backwards compatibility. */
export const ADMIN_DETAIL_TAB_ALIASES: Record<string, string> = {
  bids: "won-lots",
  payouts: "payments",
  lifecycle: "compliance",
};

export function resolveAdminDetailTabFromUrl(
  urlTab: string | null,
  tabs: readonly Pick<AdminDetailTab, "value">[],
  defaultValue: string,
): string {
  const resolved = urlTab ? (ADMIN_DETAIL_TAB_ALIASES[urlTab] ?? urlTab) : null;
  return resolved && tabs.some((t) => t.value === resolved) ? resolved : defaultValue;
}

type Props = {
  defaultValue: string;
  tabs: readonly AdminDetailTab[];
  className?: string;
  /** When true, sync active tab to `?tab=` in the URL. */
  syncUrl?: boolean;
  /** When true, offset sticky tabs below a sticky `DashboardDetailHeader`. */
  detailHeaderSticky?: boolean;
  /** Exposes programmatic tab navigation (mirrors wizard `onStepControl`). */
  onTabControl?: (control: { goTo: (value: string) => void }) => void;
};

function AdminDetailTabsInner({
  defaultValue,
  tabs,
  className,
  syncUrl = false,
  detailHeaderSticky = false,
  onTabControl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const initial = resolveAdminDetailTabFromUrl(urlTab, tabs, defaultValue);
  const [active, setActive] = useState(initial);

  useEffect(() => {
    if (!syncUrl) return;
    setActive(resolveAdminDetailTabFromUrl(urlTab, tabs, defaultValue));
  }, [urlTab, syncUrl, defaultValue, tabs]);

  const onValueChange = useCallback(
    (value: string) => {
      setActive(value);
      if (!syncUrl) return;
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [syncUrl, searchParams, router, pathname],
  );

  useEffect(() => {
    onTabControl?.({
      goTo: (value: string) => {
        if (!tabs.some((t) => t.value === value)) return;
        onValueChange(value);
      },
    });
  }, [onTabControl, onValueChange, tabs]);

  return (
    <Tabs value={active} onValueChange={onValueChange} className={cn("w-full", className)}>
      <div
        className={cn(
          "sticky z-10 -mx-1 border-b border-border-hairline bg-page-bg/95 px-1 pb-0 backdrop-blur-sm",
          adminDetailTabsStickyTop({ detailHeaderSticky }),
        )}
      >
        <TabsList
          className={cn(
            "mb-0 flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0",
            "snap-x snap-mandatory scrollbar-thin",
          )}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "shrink-0 snap-start rounded-none border-b-2 border-transparent px-3 py-2.5",
                "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                "data-[state=active]:border-accent-brand data-[state=active]:bg-transparent data-[state=active]:text-on-surface",
                "text-on-surface-variant",
              )}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {tab.label}
                {tab.badge}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="admin-tab-crossfade mt-6 focus-visible:outline-none"
        >
          <Suspense fallback={<TabContentFallback />}>{tab.content}</Suspense>
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Sticky, horizontally scrollable admin detail tabs. */
export function AdminDetailTabs(props: Props) {
  return (
    <Suspense fallback={<TabContentFallback />}>
      <AdminDetailTabsInner {...props} />
    </Suspense>
  );
}
