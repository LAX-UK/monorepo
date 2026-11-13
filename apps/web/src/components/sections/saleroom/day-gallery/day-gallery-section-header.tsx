"use client";

import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { DisplayHeading } from "@auction/ui/components/typography";
import { Button } from "@auction/ui/lax/button";
import { ChevronRight } from "lucide-react";

export type DayGallerySectionHeaderProps = {
  subtitle: string;
  total: number;
  showViewAll: boolean;
  onViewAll: () => void;
  /** The control is pointed at or focused: a chance to fetch what pressing it opens. */
  onIntent?: () => void;
};

export function DayGallerySectionHeader({
  subtitle,
  total,
  showViewAll,
  onViewAll,
  onIntent,
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
            variant="ghost"
            onClick={onViewAll}
            onPointerEnter={onIntent}
            onFocus={onIntent}
          >
            <span>View all ({total})</span>
            <span className="sr-only"> auction day media</span>
            <ChevronRight aria-hidden />
          </Button>
        ) : null
      }
    />
  );
}
