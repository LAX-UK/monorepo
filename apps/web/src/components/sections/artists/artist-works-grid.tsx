"use client";

import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotPath } from "@/lib/seo/url";
import type { Lot, LotStatus } from "@auction/types";
import { cn } from "@auction/ui";
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

type LotStatusDisplay = {
  label: string;
  className: string;
};

type LotCatalogCardProps = {
  lot: Lot;
  currentUserId: string | null;
};

const ALL_FILTER: WorkFilterOption = { label: "All", value: "all", matches: () => true };

const FILTERS: WorkFilterOption[] = [
  ALL_FILTER,
  {
    label: "Live",
    value: "live",
    matches: (lot) => lot.status === "active" || lot.status === "scheduled",
  },
  { label: "Past", value: "past", matches: (lot) => lot.status === "ended" },
];

const STATUS_DISPLAY: Record<LotStatus, LotStatusDisplay> = {
  active: { label: "live", className: "text-live-red" },
  cancelled: { label: "past", className: "text-brand-300" },
  draft: { label: "upcoming", className: "text-brand-300" },
  ended: { label: "past", className: "text-brand-300" },
  scheduled: { label: "upcoming", className: "text-lot-orange" },
};

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
    <div className="flex gap-2" aria-label="Work filters">
      {FILTERS.map((item) => {
        const selected = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
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
          </button>
        );
      })}
    </div>
  );
}

function WorksEmptyState() {
  return (
    <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-10 text-center font-body text-on-surface-variant ring-1 ring-outline-variant/10">
      No works match this filter yet.
    </p>
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
  const status = STATUS_DISPLAY[lot.status];
  const yearMedium = lotYearMedium(lot);

  return (
    <li key={lot.id} className="group min-w-0">
      <Link
        href={lotPath(lot)}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
        <div className="pt-3">
          <p
            className={cn(
              "font-label text-[10px] font-bold uppercase tracking-[0.1em]",
              status.className,
            )}
          >
            {status.label}
          </p>
          <h3 className="mt-1 font-headline text-base font-semibold leading-5 text-on-surface underline-offset-4 group-hover:underline">
            {lot.title}
          </h3>
          {yearMedium ? (
            <p className="mt-0.5 font-body text-xs italic text-on-surface-variant">{yearMedium}</p>
          ) : null}
          {est ? (
            <p className="mt-1 font-body text-xs text-on-surface-variant">Est. {est}</p>
          ) : null}
          <p className="mt-1 font-body text-xs font-medium text-on-surface-variant">
            {price.label} {price.value}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ArtistWorksGrid({ lots, currentUserId }: Props) {
  const [filter, setFilter] = useState<WorkFilter>("all");
  const visibleLots = useMemo(() => lots.filter(getFilter(filter).matches), [filter, lots]);

  return (
    <section aria-labelledby="artist-works-heading">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-divider-soft pb-4">
        <h2
          id="artist-works-heading"
          className="font-headline text-2xl font-semibold tracking-tight text-on-surface"
        >
          Selected works
        </h2>
        <WorkFilterControls value={filter} onChange={setFilter} />
      </div>
      {visibleLots.length === 0 ? (
        <WorksEmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLots.map((lot) => (
            <LotCatalogCard key={lot.id} lot={lot} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </section>
  );
}
