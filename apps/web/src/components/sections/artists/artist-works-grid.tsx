"use client";

import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotCatalogStatusPresentation } from "@/lib/marketing/lot-catalog-status";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useMemo, useState } from "react";

type WorkFilter = "all" | "live" | "past";

type Props = {
  lots: Lot[];
  currentUserId: string | null;
};

type WorkFilterOption = {
  label: string;
  value: WorkFilter;
  matches: (lot: Lot) => boolean;
};

type LotCatalogCardProps = {
  lot: Lot;
  currentUserId: string | null;
};

const ALL_FILTER: WorkFilterOption = { label: "All", value: "all", matches: () => true };

const FILTERS: WorkFilterOption[] = [
  ALL_FILTER,
  {
    label: "Upcoming",
    value: "live",
    matches: (lot) => lot.status === "active" || lot.status === "scheduled",
  },
  { label: "Past results", value: "past", matches: (lot) => lot.status === "ended" },
];

function getFilter(filter: WorkFilter) {
  return FILTERS.find((item) => item.value === filter) ?? ALL_FILTER;
}

function WorkFilterControls({
  value,
  onChange,
}: {
  value: WorkFilter;
  onChange: (value: WorkFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Work filters">
      {FILTERS.map((item) => {
        const selected = value === item.value;
        return (
          <Button
            key={item.value}
            type="button"
            variant="ghost"
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-full border px-3 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
              selected
                ? "border-on-surface bg-on-surface text-surface"
                : "border-outline-variant/40 text-on-surface-variant hover:border-on-surface/40 hover:text-on-surface",
            )}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

function lotYearMedium(lot: Lot): string | null {
  const year = lot.createdAt instanceof Date ? lot.createdAt.getUTCFullYear() : null;
  const medium = lot.medium?.trim() || null;
  if (year && medium) return `${year} \u00B7 ${medium}`;
  if (year) return String(year);
  if (medium) return medium;
  return null;
}

function LotCatalogCard({ lot, currentUserId }: LotCatalogCardProps) {
  const img = lot.images[0];
  const est = lotEstimateLine(lot);
  const price = lotPriceDisplay(lot);
  const status = lotCatalogStatusPresentation(lot.status);
  const yearMedium = lotYearMedium(lot);

  return (
    <li className="group flex h-full min-w-0 flex-col">
      <Link
        href={lotPath(lot)}
        className="flex h-full min-w-0 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-container-low">
          <MediaImage
            src={img}
            alt={lot.title}
            label="Lot artwork"
            imgClassName="transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <OwnerBadge
            owned={Boolean(currentUserId && lot.sellerId === currentUserId)}
            className="absolute right-3 top-3"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col pt-3">
          <p
            className={cn(
              "font-label text-[10px] font-bold uppercase tracking-[0.1em]",
              status.className,
            )}
          >
            {status.label}
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-10 font-headline text-base font-semibold leading-5 text-on-surface underline-offset-4 group-hover:underline">
            {lot.title}
          </h3>
          {yearMedium ? (
            <p className="mt-0.5 line-clamp-1 font-body text-xs italic text-on-surface-variant">
              {yearMedium}
            </p>
          ) : null}
          {est ? (
            <p className="mt-1 line-clamp-1 font-body text-xs text-on-surface-variant">
              Est. {est}
            </p>
          ) : null}
          <p className="mt-1 line-clamp-1 font-body text-xs font-medium text-on-surface-variant">
            {price.label} {price.value}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ArtistWorksGrid({ lots, currentUserId }: Props) {
  const initial: WorkFilter = useMemo(() => {
    const hasUpcoming = lots.some((l) => l.status === "active" || l.status === "scheduled");
    return hasUpcoming ? "live" : "all";
  }, [lots]);
  const [filter, setFilter] = useState<WorkFilter>(initial);
  const visibleLots = useMemo(() => lots.filter(getFilter(filter).matches), [filter, lots]);
  const countLabel = `${visibleLots.length} lot${visibleLots.length === 1 ? "" : "s"}`;

  return (
    <section aria-labelledby="artist-works-heading">
      <h2 id="artist-works-heading" className="sr-only">
        Lots
      </h2>
      <MarketingListToolbar
        countLabel={countLabel}
        trailing={<WorkFilterControls value={filter} onChange={setFilter} />}
      />
      {visibleLots.length === 0 ? (
        <MarketingEmptyState
          variant="panel"
          context="filtered"
          title="No works match this filter"
          description="Try another filter to browse this artist's catalogue."
        />
      ) : (
        <ul className="mt-8 grid auto-rows-fr grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleLots.map((lot) => (
            <LotCatalogCard key={lot.id} lot={lot} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </section>
  );
}
