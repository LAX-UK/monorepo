"use client";

import { type SaleFilter, salesHref } from "@/lib/marketing/sales-filters";
import { cn } from "@auction/ui";
import { Tabs, TabsList, TabsTrigger } from "@auction/ui";
import Link from "next/link";

const triggerClass = cn(
  "h-11 rounded-none border-0 bg-transparent px-0 py-3 font-label text-xs font-semibold uppercase tracking-[0.12em] text-brand-300 shadow-none",
  "data-[state=active]:border-0 data-[state=active]:bg-transparent data-[state=active]:text-brand-900",
  "data-[state=active]:border-b-[1.5px] data-[state=active]:border-brand-800 data-[state=active]:shadow-none",
  "hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  "dark:text-on-surface dark:data-[state=active]:text-on-surface",
);

type Props = {
  filter: SaleFilter;
  categoryId: string | undefined;
};

type TabValue = "live" | "current" | "results";

function tabValue(filter: SaleFilter): TabValue {
  if (filter === "ended") return "results";
  if (filter === "live" || filter === "active") return "live";
  return "current";
}

export function SalesTabs({ filter, categoryId }: Props) {
  const v = tabValue(filter);

  return (
    <div className="w-full">
      <Tabs value={v} className="w-full">
        <TabsList
          className={cn(
            "h-auto w-full min-w-0 flex-wrap justify-start gap-12 rounded-none border-0 border-b border-brand-100 bg-transparent p-0 dark:border-outline-variant/40",
          )}
        >
          <TabsTrigger value="live" asChild>
            <Link
              href={salesHref("live", categoryId)}
              className={cn(triggerClass, "inline-flex items-center")}
              aria-current={v === "live" ? "page" : undefined}
            >
              Live now
            </Link>
          </TabsTrigger>
          <TabsTrigger value="current" asChild>
            <Link
              href={salesHref("current", categoryId)}
              className={cn(triggerClass, "inline-flex items-center")}
              aria-current={v === "current" ? "page" : undefined}
            >
              Upcoming
            </Link>
          </TabsTrigger>
          <TabsTrigger value="results" asChild>
            <Link
              href={salesHref("ended", categoryId)}
              className={cn(triggerClass, "inline-flex items-center")}
              aria-current={v === "results" ? "page" : undefined}
            >
              Past Results
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
