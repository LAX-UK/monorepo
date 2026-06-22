"use client";

import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { Button, DisplayHeading } from "@auction/ui";
import { ChevronRight } from "lucide-react";

export type DayGallerySectionHeaderProps = {
  subtitle: string;
  total: number;
  showViewAll: boolean;
  onViewAll: () => void;
};

export function DayGallerySectionHeader({
  subtitle,
  total,
  showViewAll,
  onViewAll,
}: DayGallerySectionHeaderProps) {
  return (
    <MarketingSectionHeader
      heading={
        <DisplayHeading
          as="h2"
          id="auction-day-gallery-heading"
          size="section"
          className="font-semibold text-on-surface"
        >
          Auction day
        </DisplayHeading>
      }
      subtitle={subtitle}
      action={
        showViewAll ? (
          <Button
            type="button"
            variant="chevron"
            className="inline-flex items-center gap-[11px] py-[18px] text-base font-semibold leading-6 tracking-[0.05em] text-on-surface"
            onClick={onViewAll}
          >
            <span>View all ({total})</span>
            <span className="sr-only"> auction day media</span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Button>
        ) : null
      }
    />
  );
}
