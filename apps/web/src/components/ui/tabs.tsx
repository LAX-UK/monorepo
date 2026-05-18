"use client";

import { cn } from "@auction/ui";
import {
  Tabs as UiTabs,
  TabsContent as UiTabsContent,
  TabsList as UiTabsList,
  TabsTrigger as UiTabsTrigger,
} from "@auction/ui/components/tabs";
import type { ReactNode } from "react";

export function Tabs({
  defaultValue,
  children,
  className = "",
}: {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UiTabs defaultValue={defaultValue} className={className}>
      {children}
    </UiTabs>
  );
}

Tabs.List = function TabsList({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <UiTabsList className={cn("h-auto flex-wrap gap-2 rounded-none bg-transparent p-0", className)}>
      {children}
    </UiTabsList>
  );
};

Tabs.Trigger = function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UiTabsTrigger
      value={value}
      className={cn(
        "rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] transition-colors",
        "data-[state=active]:bg-primary data-[state=active]:text-on-primary",
        "data-[state=inactive]:bg-surface-container-high data-[state=inactive]:text-on-surface-variant data-[state=inactive]:hover:text-on-surface",
        className,
      )}
    >
      {children}
    </UiTabsTrigger>
  );
};

Tabs.Content = function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UiTabsContent
      value={value}
      className={cn(
        "mt-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0",
        className,
      )}
    >
      {children}
    </UiTabsContent>
  );
};
