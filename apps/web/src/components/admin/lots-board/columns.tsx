"use client";

import { LotStatusCell } from "@/components/admin/lots-board/lot-status-cell";
import type { LotStatus } from "@auction/types";
import { InlineActionMenu } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatDateTime } from "@/lib/ui/format";

export type AdminLotTableRow = {
  id: string;
  title: string;
  auctionType: string;
  status: LotStatus;
  endTimeIso: string;
  endTimeLabel: string;
  currentPrice: string;
  lastActivityType?: string;
  lastActivityAt?: string;
  lastActivityLabel?: string;
};

export function LotActionMenu({ row }: { row: AdminLotTableRow }) {
  const router = useRouter();
  return (
    <InlineActionMenu
      label={`Actions for ${row.title}`}
      items={[
        {
          type: "item",
          label: "Open detail",
          onSelect: () => router.push(`/admin/lots/${row.id}`),
        },
        {
          type: "item",
          label: "Copy lot ID",
          onSelect: () => void navigator.clipboard.writeText(row.id),
        },
      ]}
    />
  );
}

export function lotColumns(): ColumnDef<AdminLotTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link
          href={`/admin/lots/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "auctionType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{row.original.auctionType}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <LotStatusCell lotId={row.original.id} status={row.original.status} />,
    },
    {
      id: "lastActivity",
      header: "Last activity",
      cell: ({ row }) =>
        row.original.lastActivityLabel ? (
          <div className="text-xs text-on-surface-variant">
            <p className="text-on-surface">{row.original.lastActivityLabel}</p>
            {row.original.lastActivityAt ? (
              <time dateTime={row.original.lastActivityAt}>
                {formatDateTime(new Date(row.original.lastActivityAt))}
              </time>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant">—</span>
        ),
    },
    {
      accessorKey: "endTimeLabel",
      header: "Ends",
      cell: ({ row }) => (
        <time dateTime={row.original.endTimeIso} className="text-xs text-on-surface-variant">
          {row.original.endTimeLabel}
        </time>
      ),
    },
    {
      accessorKey: "currentPrice",
      header: () => <span className="block text-right">Hammer</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">{row.original.currentPrice}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <LotActionMenu row={row.original} />,
      enableSorting: false,
    },
  ];
}
