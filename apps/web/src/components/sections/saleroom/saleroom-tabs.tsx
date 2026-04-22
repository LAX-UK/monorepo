import { Badge } from "@auction/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import Link from "next/link";
import type { ReactNode } from "react";

export type TabKey = "catalog" | "bidders";

export type TabDescriptor = {
  key: TabKey;
  label: string;
  count?: number;
};

type Props = {
  /** OCP: callers pass tab descriptors — adding a new tab requires no changes here. */
  tabs: TabDescriptor[];
  activeTab: TabKey;
  /** Base path for link — e.g. `/sales/:id`. Query string is rebuilt below. */
  basePath: string;
  /** Preserved query params (e.g. `sort`, `page`) passed as `name=value` strings. */
  preservedQuery?: Array<[string, string]>;
  children: ReactNode;
};

function buildHref(basePath: string, tab: TabKey, preserved: Array<[string, string]> = []): string {
  const qs = new URLSearchParams();
  qs.set("tab", tab);
  for (const [k, v] of preserved) {
    if (k === "tab" || k === "page") continue;
    if (v) qs.set(k, v);
  }
  return `${basePath}?${qs.toString()}`;
}

/**
 * SSR-friendly tab container — URL is source of truth (`?tab=`).
 */
export function SaleroomTabs({ tabs, activeTab, basePath, preservedQuery, children }: Props) {
  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList
        aria-label="Saleroom sections"
        className="mb-10 flex h-auto w-full justify-start gap-12 rounded-none border-b border-[#D1D1D1] bg-transparent p-0"
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const href = buildHref(basePath, tab.key, preservedQuery);
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              asChild
              className="relative inline-flex min-h-10 items-center gap-1.5 rounded-none border-0 border-b-[1.5px] border-transparent bg-transparent px-0 py-2.5 font-['DM_Sans',sans-serif] text-lg font-semibold uppercase leading-[21px] text-[#1C170D] shadow-none data-[state=active]:border-b-[#000000] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Link href={href} className={active ? "text-[#1C170D]" : "text-[#1C170D]/80"}>
                {tab.label}
                {typeof tab.count === "number" ? (
                  <Badge
                    variant={active ? "default" : "secondary"}
                    className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold normal-case"
                  >
                    {tab.count}
                  </Badge>
                ) : null}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={activeTab} forceMount className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
}
