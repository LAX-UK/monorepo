"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { conveyorStageForRow } from "@/lib/admin/conveyor-pipeline.vm";
import type { AdminConveyorPipelineRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function conveyorColumns(): ColumnDef<AdminConveyorPipelineRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Submission",
      cell: ({ row }) => (
        <Link
          href={`/admin/submissions/${row.original.submissionId}`}
          className="max-w-[14rem] truncate font-medium text-link hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "submissionStatus",
      header: "Submission status",
      cell: ({ row }) => (
        <AdminStatusBadge domain="submission" status={row.original.submissionStatus} />
      ),
    },
    {
      id: "stage",
      header: "Stage",
      cell: ({ row }) => (
        <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          {conveyorStageForRow(row.original)}
        </span>
      ),
    },
    {
      id: "lot",
      header: "Lot",
      cell: ({ row }) =>
        row.original.lotId ? (
          <Button variant="link" className="h-auto px-0 text-sm" asChild>
            <Link href={`/admin/lots/${row.original.lotId}`}>
              {row.original.lotStatus?.replaceAll("_", " ") ?? "View lot"}
            </Link>
          </Button>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
    },
  ];
}
