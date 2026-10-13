"use client";

import { cn } from "@auction/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { type ReactNode, useId } from "react";

export type MarketingUnderlineTabsPanelItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export type MarketingUnderlineTabsPanelProps = {
  items: readonly MarketingUnderlineTabsPanelItem[];
  ariaLabel: string;
  className?: string;
};

/**
 * In-page tab panels with Bid's route-tab underline (uppercase semibold label, 1.5px rule).
 * Renders the single panel without a tab list when only one item has content.
 */
export function MarketingUnderlineTabsPanel({
  items,
  ariaLabel,
  className,
}: MarketingUnderlineTabsPanelProps) {
  const headingId = useId();
  const first = items[0];
  if (!first) return null;
  if (items.length === 1) {
    return (
      <section aria-labelledby={headingId} className={className}>
        <h2
          id={headingId}
          className="mb-3 border-b border-outline-variant pb-2 font-body text-base font-semibold uppercase leading-5 text-on-surface"
        >
          {first.label}
        </h2>
        {first.content}
      </section>
    );
  }
  return (
    <Tabs defaultValue={first.id} className={className}>
      <TabsList
        aria-label={ariaLabel}
        className="flex h-auto w-full flex-wrap justify-start gap-x-5 rounded-none border-b border-outline-variant bg-transparent p-0 sm:gap-x-8"
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap rounded-none border-b-[1.5px] border-transparent bg-transparent px-0 py-2 font-body text-base font-semibold uppercase leading-5 text-nav-text shadow-none",
              "hover:text-on-surface motion-safe:transition-[color,border-color] motion-safe:duration-200",
              "data-[state=active]:border-on-surface data-[state=active]:bg-transparent data-[state=active]:text-on-surface data-[state=active]:shadow-none",
              "focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.id} value={item.id} className="mt-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
