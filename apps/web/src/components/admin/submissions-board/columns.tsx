"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { SubmissionQualityBadges } from "@/components/admin/submissions-board/quality-badges";
import { SubmissionSlaCell } from "@/components/admin/submissions-board/sla-cell";
import { MediaImage } from "@/components/ui/media-image";
import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

function submissionInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SubmissionTitleCell({
  row,
  onOpen,
}: {
  row: AdminSubmissionTableRow;
  onOpen: (row: AdminSubmissionTableRow) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.thumbnailUrl ? (
        <MediaImage
          src={row.thumbnailUrl}
          alt=""
          label={row.title}
          sizes="48px"
          className="size-12 shrink-0 overflow-hidden rounded-lg"
          imgClassName="size-full object-cover"
        />
      ) : (
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-shell-search-bg font-label text-xs font-semibold uppercase text-on-surface-variant"
          aria-hidden
        >
          {submissionInitials(row.title)}
        </div>
      )}
      <div className="min-w-0">
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-headline text-sm font-semibold text-on-surface"
          onClick={() => onOpen(row)}
        >
          {row.title}
        </Button>
        {row.categoryPreview ? (
          <p className="truncate font-label text-xs text-on-surface-variant">
            {row.categoryPreview}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function submissionColumns(
  onOpen: (row: AdminSubmissionTableRow) => void,
): ColumnDef<AdminSubmissionTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Submission",
      cell: ({ row }) => <SubmissionTitleCell row={row.original} onOpen={onOpen} />,
    },
    {
      accessorKey: "sellerPreview",
      header: "Seller",
      cell: ({ row }) => (
        <span className="font-body text-xs text-on-surface-variant">
          {row.original.sellerPreview}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="submission" status={row.original.status} />,
    },
    {
      id: "sla",
      header: "SLA",
      cell: ({ row }) => (
        <SubmissionSlaCell label={row.original.slaLabel} tone={row.original.slaTone} />
      ),
      enableSorting: false,
    },
    {
      id: "quality",
      header: "Quality",
      cell: ({ row }) => (
        <SubmissionQualityBadges
          warnings={row.original.qualityWarnings}
          blocksAccept={row.original.blocksAccept}
          summaryLabel={row.original.qualitySummaryLabel}
          compact
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "assigneeLabel",
      header: "Assignee",
      cell: ({ row }) => {
        const { assigneeUserId, assigneeLabel, isUnassigned } = row.original;
        if (isUnassigned || !assigneeUserId) {
          return <span className="font-body text-xs text-on-surface-variant">Unassigned</span>;
        }
        return (
          <span className="inline-flex items-center gap-2">
            <AdminUserAvatar
              user={{
                id: assigneeUserId,
                name: assigneeLabel,
                image: null,
              }}
              size="sm"
            />
            <span className="font-body text-xs text-on-surface">{assigneeLabel}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "createdAtIso",
      header: "Created",
      cell: ({ row }) => (
        <AdminTableDateTimeCell iso={row.original.createdAtIso} mode="timestamp" />
      ),
    },
    {
      id: "accept",
      header: "Accept",
      cell: ({ row }) => (
        <SubmissionInlineActions
          submissionId={row.original.id}
          status={row.original.status}
          variant="accept-only"
        />
      ),
      enableSorting: false,
    },
    {
      id: "reject",
      header: "Reject",
      cell: ({ row }) => (
        <SubmissionInlineActions
          submissionId={row.original.id}
          status={row.original.status}
          variant="reject-only"
        />
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="min-h-11" asChild>
            <Link href={`/admin/submissions/${row.original.id}`}>Review</Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
