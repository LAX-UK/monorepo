"use client";

import { CatalogDetailTabCard } from "@/components/admin/catalog";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

type Props = {
  title?: string;
  description?: string;
  events: readonly AdminDomainEventRow[];
  exportFilters?: Record<string, unknown>;
  emptyMessage?: string;
  previewLimit?: number;
  viewAllHref?: string;
  sectionId?: string;
};

/** Shared activity preview card for sale/lot detail overview tabs. */
export function DetailActivityPreviewSection({
  title = "Recent activity",
  description = "Timeline of changes and key events.",
  events,
  exportFilters,
  emptyMessage = "No activity recorded yet.",
  previewLimit = 5,
  viewAllHref,
  sectionId = "activity",
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const preview = showAll ? events : events.slice(0, previewLimit);

  return (
    <div id={sectionId}>
      <CatalogDetailTabCard
        title={title}
        description={description}
        countBadge={events.length}
        footer={
          !showAll && events.length > previewLimit ? (
            viewAllHref ? (
              <a
                href={viewAllHref}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
              >
                View all activity →
              </a>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(true)}
                className="h-auto p-0 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:bg-transparent hover:underline"
              >
                View all activity →
              </Button>
            )
          ) : undefined
        }
      >
        <CatalogDomainEventsTimeline
          events={preview}
          showTechnicalDetails={false}
          emptyMessage={emptyMessage}
          {...(exportFilters
            ? {
                exportFilters: exportFilters as { aggregateType: string; aggregateId: string },
              }
            : {})}
        />
      </CatalogDetailTabCard>
    </div>
  );
}
