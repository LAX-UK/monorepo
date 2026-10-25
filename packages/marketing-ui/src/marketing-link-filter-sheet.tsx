"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import { MarketingFilterSheet } from "./marketing-filter-sheet.js";
import { MarketingFilterTrigger } from "./marketing-filter-trigger.js";

export type MarketingLinkFilterSheetProps = {
  /** Server-rendered link groups (`MarketingFilterLinkGroups`). */
  children: ReactNode;
  activeCount: number;
  /** "12 artists", shown on the confirm button and announced politely. */
  resultLabel: string;
  /** Where "Reset" goes: the directory without user filters. */
  resetHref: string;
  title?: string;
  description?: string;
};

/**
 * Mobile filter sheet for link-based directories. Following any link inside closes the sheet,
 * so the page behind shows the new results.
 */
export function MarketingLinkFilterSheet({
  children,
  activeCount,
  resultLabel,
  resetHref,
  title = "Filters",
  description = "Filter and sort the directory.",
}: MarketingLinkFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);
  const closeOnLink = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement | null)?.closest("a[href]")) close();
    },
    [close],
  );

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultLabel}
      onApply={close}
      onReset={() => {
        router.push(resetHref);
        close();
      }}
    >
      {/* Link clicks bubble here; keyboard activation of a link fires click too. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only observes link activation, adds no interaction of its own. */}
      <div onClick={closeOnLink}>{children}</div>
    </MarketingFilterSheet>
  );
}
