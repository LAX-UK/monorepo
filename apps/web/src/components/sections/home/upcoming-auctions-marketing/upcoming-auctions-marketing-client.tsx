"use client";

import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UpcomingAuctionMarketingCard } from "./upcoming-auction-marketing-card";

export type UpcomingAuctionsMarketingFilter = "all" | "onsite" | "online";

type Props = {
  tiles: HomeUpcomingAuctionTileVM[];
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

export function UpcomingAuctionsMarketingClient({ tiles }: Props) {
  const [filter, setFilter] = useState<UpcomingAuctionsMarketingFilter>("all");
  const visible = useMemo(() => tiles.filter((t) => matchesFilter(t, filter)), [tiles, filter]);

  return (
    <section
      aria-labelledby="home-upcoming-auctions-heading"
      className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-[720px] flex-col gap-2">
            <DisplayHeading
              as="h2"
              id="home-upcoming-auctions-heading"
              className="text-[40px] font-semibold leading-[60px] text-[#050505] dark:text-on-surface"
            >
              Upcoming Auctions
            </DisplayHeading>
            <p className="font-headline text-2xl font-normal leading-9 text-[#757575] dark:text-on-surface-variant">
              Scheduled and live sales curated by LAX specialists
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#F1F1F3] p-1 outline outline-1 outline-[rgba(209,209,209,0.65)] -outline-offset-1 dark:bg-surface-container-high dark:outline-outline/40"
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
                        ? "inline-flex h-6 items-center rounded bg-[#050505] px-3 py-1 font-label text-xs font-semibold uppercase tracking-[0.05em] text-[#F1F1F3] dark:bg-on-surface dark:text-surface"
                        : "inline-flex h-6 items-center rounded px-3 py-1 font-label text-xs font-semibold uppercase tracking-[0.05em] text-[#050505] dark:text-on-surface"
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <Button
              variant="chevron"
              asChild
              className="h-auto border-0 bg-transparent p-0 shadow-none hover:bg-transparent dark:hover:bg-transparent"
            >
              <Link
                href="/sales"
                className="inline-flex items-center gap-[11px] py-[18px] font-headline text-base font-semibold leading-6 tracking-[0.05em] text-[#050505] dark:text-on-surface"
              >
                View All
                <span className="sr-only"> auctions and sales</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
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
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8 sm:items-stretch">
            {visible.map((tile) => (
              <UpcomingAuctionMarketingCard key={tile.id} tile={tile} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
