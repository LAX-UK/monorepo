"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { SubmissionQualityBadges } from "@/components/admin/submissions-board/quality-badges";
import { SubmissionSlaCell } from "@/components/admin/submissions-board/sla-cell";
import { Button } from "@auction/ui";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";

type Props = {
  rows: AdminSubmissionTableRow[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onOpen: (row: AdminSubmissionTableRow) => void;
};

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
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="submission" status={r.status} />
              <span className="font-body text-[10px] text-on-surface-variant">
                {r.createdAtLabel}
                {r.assigneeLabel !== "—" ? ` · ${r.assigneeLabel}` : ""}
              </span>
              <SubmissionSlaCell label={r.slaLabel} tone={r.slaTone} />
              <SubmissionQualityBadges
                warnings={r.qualityWarnings}
                blocksAccept={r.blocksAccept}
                compact
              />
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
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}
