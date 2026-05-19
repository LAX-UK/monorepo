"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import type { AdminEmailOutboxRow } from "@/lib/data/http/admin.server";
import { EntityList } from "@auction/ui";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function shortHash(value: string): string {
  return `${value.slice(0, 10)}…`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : "masked";
}

function statusVariant(
  status: AdminEmailOutboxRow["status"],
): "success" | "danger" | "warning" | "neutral" {
  if (status === "sent") return "success";
  if (status === "failed" || status === "suppressed") return "danger";
  if (status === "sending") return "warning";
  return "neutral";
}

function columns(): ColumnDef<AdminEmailOutboxRow>[] {
  return [
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="font-body text-sm">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "recipient",
      header: "Recipient",
      cell: ({ row }) => (
        <span className="font-body text-sm">
          {row.original.userEmail
            ? maskEmail(row.original.userEmail)
            : shortHash(row.original.toEmailHash)}
        </span>
      ),
    },
    {
      accessorKey: "template",
      header: "Template",
      cell: ({ row }) => <span className="font-body text-sm">{row.original.template}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={statusVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      id: "message",
      header: "Message",
      cell: ({ row }) => (
        <span className="max-w-48 truncate font-body text-sm">
          {row.original.messageId ?? row.original.lastError ?? "—"}
        </span>
      ),
      enableSorting: false,
    },
  ];
}

export function AdminEmailOutboxBoard({ rows }: { rows: AdminEmailOutboxRow[] }) {
  const { density } = useTableDensity();
  const tableColumns = useMemo(() => columns(), []);

  return (
    <EntityList
      density={density}
      responsiveMode="scroll"
      table={
        <TableScroll>
          <AdminDataTable
            ariaLabel="Email outbox"
            columns={tableColumns}
            data={rows}
            getRowId={(r) => r.id}
            density={density}
          />
        </TableScroll>
      }
    />
  );
}
