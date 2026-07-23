"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { SubmissionQualityBadges } from "@/components/admin/submissions-board/quality-badges";
import { SubmissionSlaCell } from "@/components/admin/submissions-board/sla-cell";
import { MediaImage } from "@/components/ui/media-image";
import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import { Button } from "@auction/ui";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";

type Props = {
  rows: AdminSubmissionTableRow[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onOpen: (row: AdminSubmissionTableRow) => void;
};

function submissionInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SubmissionsMobileCards({
  rows,
  rowSelection,
  onRowSelectionChange,
  onOpen,
}: Props) {
  return (
    <CatalogVirtualizedList itemCount={rows.length}>
      {rows.map((r) => (
        <CatalogMobileCardShell
          key={r.id}
          id={r.id}
          title={r.title}
          selected={rowSelection?.[r.id]}
          onSelectedChange={
            onRowSelectionChange
              ? (checked) => {
                  onRowSelectionChange((prev) => ({
                    ...prev,
                    [r.id]: checked,
                  }));
                }
              : undefined
          }
          selectionLabel={`Select ${r.title}`}
          status={
            <div className="flex flex-col gap-1.5">
              <AdminStatusBadge domain="submission" status={r.status} />
              <div className="flex flex-nowrap gap-2 overflow-x-auto">
                <SubmissionSlaCell label={r.slaLabel} tone={r.slaTone} />
                <SubmissionQualityBadges
                  warnings={r.qualityWarnings}
                  blocksAccept={r.blocksAccept}
                  summaryLabel={r.qualitySummaryLabel}
                  compact
                />
              </div>
              <span className="truncate font-body text-[10px] text-on-surface-variant">
                <AdminTableDateTimeCell iso={r.createdAtIso} mode="timestamp" />
                {r.assigneeLabel !== "Unassigned" ? ` · ${r.assigneeLabel}` : ""}
              </span>
            </div>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 flex-1"
                onClick={() => onOpen(r)}
              >
                Preview
              </Button>
              <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                <Link href={`/admin/submissions/${r.id}`}>Review</Link>
              </Button>
              <SubmissionInlineActions submissionId={r.id} status={r.status} />
            </div>
          }
        >
          <div className="flex items-start gap-3">
            {r.thumbnailUrl ? (
              <MediaImage
                src={r.thumbnailUrl}
                alt=""
                label={r.title}
                sizes="48px"
                className="size-12 shrink-0 overflow-hidden rounded-lg"
                imgClassName="size-full object-cover"
              />
            ) : (
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-shell-search-bg font-label text-xs font-semibold uppercase text-on-surface-variant"
                aria-hidden
              >
                {submissionInitials(r.title)}
              </div>
            )}
            <div className="min-w-0">
              <Button
                type="button"
                variant="link"
                size="link"
                className="h-auto p-0 text-left font-headline text-sm text-on-surface hover:text-link"
                onClick={() => onOpen(r)}
              >
                {r.title}
              </Button>
              <p className="mt-1 font-body text-xs text-on-surface-variant">{r.sellerPreview}</p>
              {r.categoryPreview ? (
                <p className="font-label text-[10px] text-on-surface-variant">
                  {r.categoryPreview}
                </p>
              ) : null}
            </div>
          </div>
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}
