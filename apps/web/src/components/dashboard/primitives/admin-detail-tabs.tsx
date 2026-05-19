"use client";

import { cn } from "@auction/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import type { ReactNode } from "react";

export type AdminDetailTab = {
  value: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
};

type Props = {
  defaultValue: string;
  tabs: readonly AdminDetailTab[];
  className?: string;
};

/** Sticky, horizontally scrollable admin detail tabs. */
export function AdminDetailTabs({ defaultValue, tabs, className }: Props) {
  return (
    <Tabs defaultValue={defaultValue} className={cn("w-full", className)}>
      <div className="sticky top-[calc(var(--header-height-mobile,56px)+3.5rem)] z-10 -mx-1 border-b border-border-hairline bg-page-bg/95 px-1 pb-0 backdrop-blur-sm md:top-[calc(var(--header-height-shell,52px)+3.5rem)]">
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
        <TabsContent key={tab.value} value={tab.value} className="mt-6 focus-visible:outline-none">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
