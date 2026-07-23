"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

function screeningAgeLabel(screenedAt: string): string {
  const at = Date.parse(screenedAt);
  if (!Number.isFinite(at)) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - at) / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function amlColumns(onOpen: (row: AdminAmlTableRow) => void): ColumnDef<AdminAmlTableRow>[] {
  const open = onOpen;
  return [
    {
      id: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <Link
          href={`/admin/clients/${row.original.userId}`}
          className="text-link underline"
          onClick={(e) => e.stopPropagation()}
        >
          Client {row.original.userId.slice(0, 8)}
        </Link>
      ),
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-sm text-on-surface-variant"
          title={formatDateTime(row.original.screenedAt)}
        >
          {screeningAgeLabel(row.original.screenedAt)}
        </span>
      ),
    },
    {
      id: "match",
      header: "Match",
      cell: ({ row }) => <AdminStatusBadge domain="amlMatch" status={row.original.matchStatus} />,
    },
    {
      id: "outcome",
      header: "Policy",
      cell: ({ row }) => (
        <AdminStatusBadge domain="amlDecision" status={row.original.decisionOutcome} />
      ),
    },
    {
      id: "triage",
      header: "Triage / owner",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="text-on-surface">{row.original.triageLabel}</p>
          {row.original.triagedByUserId ? (
            <p className="text-xs text-on-surface-variant">Analyst assigned</p>
          ) : (
            <p className="text-xs text-warning">Unassigned</p>
          )}
        </div>
      ),
    },
    {
      id: "hits",
      header: "Hits",
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.totalHits}</span>,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => open(row.original)}>
          Review
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
