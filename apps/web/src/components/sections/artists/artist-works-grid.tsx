"use client";

import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import { MarketingWorkCard, MarketingWorkGrid } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { isPublicLotStatus } from "@auction/validators";
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
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Show lots</legend>
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
              "inline-flex items-center border font-body transition-colors motion-reduce:transition-none",
              FOCUS_RING,
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/40 text-on-surface-variant hover:border-on-surface/40 hover:text-on-surface",
            )}
          >
            {item.label}
          </Button>
        );
      })}
    </fieldset>
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
  const est = lotEstimateLine(lot);
  const price = lotPriceDisplay(lot);
  const yearMedium = lotYearMedium(lot);
  const owned = Boolean(currentUserId && lot.sellerId === currentUserId);

  return (
    <MarketingWorkCard
      href={lotPath(lot)}
      title={lot.title}
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      {...(owned ? { mediaBadge: <OwnerBadge owned /> } : {})}
      {...(isPublicLotStatus(lot.status)
        ? { mediaStatus: <LotStatusBadge {...lotStatusBadgeProps(lot)} /> }
        : {})}
      details={
        <>
          {yearMedium ? <p className="line-clamp-1">{yearMedium}</p> : null}
          {est ? <p className="line-clamp-1">Estimate {est}</p> : null}
        </>
      }
      footer={
        <p className="line-clamp-1">
          {price.label} {price.value}
        </p>
      }
    />
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
    <div>
      <MarketingListToolbar
        countLabel={countLabel}
        gutter={false}
        stackTrailingOnMobile
        trailing={<WorkFilterControls value={filter} onChange={setFilter} />}
      />
      {visibleLots.length === 0 ? (
        <MarketingEmptyState
          variant="panel"
          size="compact"
          headingLevel="h3"
          context="filtered"
          title="No works match this filter"
          description="Try another filter to browse this artist's catalogue."
        />
      ) : (
        <MarketingWorkGrid className="mt-8" aria-label="Lots by this artist">
          {visibleLots.map((lot) => (
            <LotCatalogCard key={lot.id} lot={lot} currentUserId={currentUserId} />
          ))}
        </MarketingWorkGrid>
      )}
    </div>
  );
}
