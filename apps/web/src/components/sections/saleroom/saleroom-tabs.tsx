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
 * SSR-friendly tab container built on shadcn `Tabs`.
 * State lives in the URL (`?tab=`) so tabs are shareable and SEO-safe;
 * each trigger is a `<Link>` via `asChild`, so no client JS is required
 * for navigation. The Radix root is controlled (`value`) without an
 * `onValueChange` handler because the URL is the source of truth.
 */
export function SaleroomTabs({ tabs, activeTab, basePath, preservedQuery, children }: Props) {
  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList
        aria-label="Saleroom sections"
        className="sticky top-0 z-10 mb-8 flex h-auto w-full justify-start gap-6 rounded-none border-b border-outline-variant/40 bg-surface/90 p-0 px-6 backdrop-blur md:px-20"
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const href = buildHref(basePath, tab.key, preservedQuery);
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              asChild
              className="relative inline-flex min-h-12 items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 font-label text-sm font-semibold uppercase tracking-widest text-on-surface-variant shadow-none transition-colors hover:text-on-surface data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-on-surface data-[state=active]:shadow-none"
            >
              <Link href={href}>
                {tab.label}
                {typeof tab.count === "number" ? (
                  <Badge
                    variant={active ? "default" : "secondary"}
                    className="ml-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold"
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
