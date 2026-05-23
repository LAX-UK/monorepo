"use client";

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

export type CatalogTabPanelItem = {
  value: string;
  label: ReactNode;
  content: ReactNode;
};

type Props = {
  defaultValue: string;
  tabs: readonly CatalogTabPanelItem[];
  /** Accessible name for the tab list (required). */
  "aria-label": string;
  syncUrl?: boolean;
  className?: string;
};

/** Non-sticky tab panel for catalog detail pages. */
export function CatalogTabPanel({
  defaultValue,
  tabs,
  "aria-label": tabListAriaLabel,
  syncUrl = true,
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const tabValueKey = tabs.map((t) => t.value).join("|");
  const resolveTab = useCallback(
    (value: string | null) => {
      const validValues = tabValueKey.split("|");
      return value && validValues.includes(value) ? value : defaultValue;
    },
    [tabValueKey, defaultValue],
  );
  const [active, setActive] = useState(() => resolveTab(urlTab));

  useEffect(() => {
    if (!syncUrl) return;
    setActive(resolveTab(urlTab));
  }, [urlTab, syncUrl, resolveTab]);

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

  return (
    <Tabs value={active} onValueChange={onValueChange} className={cn("w-full", className)}>
      <TabsList
        aria-label={tabListAriaLabel}
        className={cn(
          "mb-6 flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border-hairline bg-transparent p-0",
          "snap-x snap-mandatory scrollbar-thin",
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "min-h-11 shrink-0 snap-start rounded-none border-b-2 border-transparent px-3 py-2.5",
              "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
              "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-on-surface",
              "text-on-surface-variant",
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => {
        const isActiveTab = tab.value === active;
        const renderable = tab.content != null && tab.content !== false;
        return (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="mt-0 focus-visible:outline-none"
          >
            <Suspense fallback={<TabContentFallback />}>
              {renderable ? tab.content : isActiveTab ? <TabContentFallback /> : null}
            </Suspense>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
