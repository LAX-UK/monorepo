"use client";

import { cn } from "@auction/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { type ReactNode, useId } from "react";
import {
  MARKETING_UNDERLINE_TAB,
  MARKETING_UNDERLINE_TAB_LIST,
} from "./marketing-underline-tab.js";

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
 * In-page tab panels with the shared underline tab style. Renders the single panel without a tab list when only one item has content.
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
          className="mb-3 border-b border-outline-variant pb-2 font-body text-base font-semibold leading-5 text-on-surface"
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
        className={cn(
          MARKETING_UNDERLINE_TAB_LIST,
          "h-auto w-full rounded-none bg-transparent p-0",
        )}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              MARKETING_UNDERLINE_TAB,
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
