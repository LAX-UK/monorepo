"use client";

import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/lax";
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
          <Button type="button" variant="ghost" onClick={onViewAll}>
            <span>View all ({total})</span>
            <span className="sr-only"> auction day media</span>
            <ChevronRight aria-hidden />
          </Button>
        ) : null
      }
    />
  );
}
