"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { X } from "lucide-react";
import Link from "next/link";

export type CatalogActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

type CatalogActiveFilterChipsProps = {
  chips: CatalogActiveFilterChip[];
  clearHref?: string;
  pending?: boolean;
  className?: string;
  onNavigate?: (href: string) => void;
};

/** Shared removable active-filter chip strip for marketing catalogues. */
export function CatalogActiveFilterChips({
  chips,
  clearHref,
  pending = false,
  className,
  onNavigate,
}: CatalogActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  const chipClassName =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

  const clearClassName =
    "min-h-11 px-2 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

  return (
    <MarketingChipStrip
      wrapOnDesktop
      aria-label="Active filters"
      className={cn(
        "mb-4 md:mb-6",
        pending && "opacity-70 motion-safe:transition-opacity",
        className,
      )}
    >
      {chips.map((chip) =>
        onNavigate ? (
          <Button
            key={chip.key}
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onNavigate(chip.removeHref)}
            className={chipClassName}
          >
            <span>{chip.label}</span>
            <X className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Remove filter</span>
          </Button>
        ) : (
          <Button key={chip.key} type="button" variant="ghost" asChild className={chipClassName}>
            <Link href={chip.removeHref} scroll={false}>
              <span>{chip.label}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Remove filter</span>
            </Link>
          </Button>
        ),
      )}
      {clearHref ? (
        onNavigate ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onNavigate(clearHref)}
            className={clearClassName}
          >
            Clear all
          </Button>
        ) : (
          <Button type="button" variant="ghost" asChild className={clearClassName}>
            <Link href={clearHref} scroll={false}>
              Clear all
            </Link>
          </Button>
        )
      ) : null}
    </MarketingChipStrip>
  );
}
