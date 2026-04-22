"use client";

import { UserRoleAction, UserSuspendAction } from "@/components/admin/admin-user-actions";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserRole } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function userColumns(): ColumnDef<AdminUserRow>[] {
  return [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-[14rem] truncate text-xs">{row.original.email}</span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const u = row.original;
        return <UserRoleAction userId={u.id} defaultRole={u.role as UserRole} layout="row" />;
      },
      enableSorting: false,
    },
    {
      accessorKey: "suspendedAt",
      header: "Status",
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.suspendedAt ? <span className="text-error">Suspended</span> : "Active"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex justify-end text-xs">
            <UserSuspendAction userId={u.id} suspendedAt={u.suspendedAt} />
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminUserRow[];
};

export function AdminUsersDataTable({ rows }: Props) {
  const columns = useMemo(() => userColumns(), []);
  return <DataTable columns={columns} data={rows} emptyMessage="No users match this search." />;
}
