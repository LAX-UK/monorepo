"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UpcomingAuctionMarketingCard } from "./upcoming-auction-marketing-card";

export type UpcomingAuctionsMarketingFilter = "all" | "onsite" | "online";

type Props = {
  tiles: HomeUpcomingAuctionTileVM[];
  layoutView: CatalogLayoutView;
  isAuthenticated: boolean;
};

/** Client-side only: `/sales` list has no `deliveryMode` query; tiles include both modes from one fetch. */
function matchesFilter(tile: HomeUpcomingAuctionTileVM, filter: UpcomingAuctionsMarketingFilter) {
  if (filter === "all") return true;
  if (filter === "onsite") return tile.deliveryMode === "onsite";
  if (filter === "online") return tile.deliveryMode === "online";
  return true;
}

const FILTERS: { id: UpcomingAuctionsMarketingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "onsite", label: "Onsite" },
  { id: "online", label: "Online" },
];

/** Home rail only exposes grid + list; map card → grid for the switcher. */
function homeSwitcherValue(v: CatalogLayoutView): CatalogLayoutView {
  return v === "list" ? "list" : "grid";
}

const innerMax = "mx-auto w-full max-w-[var(--container-inner,1376px)]";

export function UpcomingAuctionsMarketingClient({ tiles, layoutView, isAuthenticated }: Props) {
  const [filter, setFilter] = useState<UpcomingAuctionsMarketingFilter>("all");
  const visible = useMemo(() => tiles.filter((t) => matchesFilter(t, filter)), [tiles, filter]);
  const switcherValue = homeSwitcherValue(layoutView);
  const isList = switcherValue === "list";
  const countLabel =
    visible.length === 0
      ? "0 auctions"
      : visible.length === 1
        ? "1 auction"
        : `${visible.length} auctions`;

  return (
    <section
      aria-labelledby="home-upcoming-auctions-heading"
      className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14"
    >
      <div className="flex w-full flex-col gap-12">
        <div className={`${innerMax} flex flex-col gap-6`}>
          <MarketingSectionHeader
            heading={
              <DisplayHeading
                as="h2"
                id="home-upcoming-auctions-heading"
                size="section"
                className="font-semibold text-on-surface"
              >
                Upcoming Auctions
              </DisplayHeading>
            }
            subtitle="Scheduled and live sales curated by LAX specialists"
          />
        </div>

        <MarketingListToolbar
          countLabel={countLabel}
          filters={
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-container-high p-1 outline outline-1 outline-outline-variant/50 -outline-offset-1 dark:outline-outline/40"
                role="tablist"
                aria-label="Filter auctions"
              >
                {FILTERS.map((f) => {
                  const selected = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFilter(f.id)}
                      className={
                        selected
                          ? "inline-flex h-6 items-center rounded bg-on-surface px-3 py-1 font-label text-xs font-semibold uppercase tracking-[0.05em] text-surface"
                          : "inline-flex h-6 items-center rounded px-3 py-1 font-label text-xs font-semibold uppercase tracking-[0.05em] text-on-surface"
                      }
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <CatalogViewSwitcher
                routeKey="home-upcoming"
                value={switcherValue}
                supportedModes={["grid", "list"]}
              />
            </div>
          }
          trailing={
            <Button
              variant="chevron"
              asChild
              className="h-auto border-0 bg-transparent p-0 shadow-none hover:bg-transparent dark:hover:bg-transparent"
            >
              <Link
                href="/sales"
                className="inline-flex items-center gap-[11px] py-[18px] font-headline text-base font-semibold leading-6 tracking-[0.05em] text-on-surface"
              >
                View All
                <span className="sr-only"> auctions and sales</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </Button>
          }
        />

        <div className={`${innerMax} flex flex-col gap-4`}>
          {visible.length === 0 ? (
            <MarketingEmptyState
              variant="marketing"
              icon={<Calendar aria-hidden />}
              title="No auctions match this filter"
              description="Try another filter or browse the full catalogue."
              action={
                <Button variant="outline" asChild>
                  <Link href="/sales">View all auctions</Link>
                </Button>
              }
            />
          ) : isList ? (
            <ul className="m-0 flex w-full list-none flex-col gap-3 p-0 sm:gap-4">
              {visible.map((tile) => (
                <li key={tile.id}>
                  <UpcomingAuctionMarketingCard
                    tile={tile}
                    variant="list"
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid w-full auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-5 md:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4 xl:gap-6">
              {visible.map((tile) => (
                <UpcomingAuctionMarketingCard
                  key={tile.id}
                  tile={tile}
                  variant="grid"
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
