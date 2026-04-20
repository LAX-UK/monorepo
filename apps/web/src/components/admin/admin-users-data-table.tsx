"use client";

import {
  adminSetUserRoleAction,
  adminSuspendUserAction,
  adminUnsuspendUserAction,
} from "@/lib/actions/admin";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
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
        return (
          <form action={adminSetUserRoleAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={u.id} />
            <select
              name="role"
              defaultValue={u.role}
              className="rounded border border-outline-variant/20 bg-surface-container-lowest px-2 py-1 text-xs"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              className="font-label text-[10px] uppercase tracking-widest text-primary underline-offset-2 hover:underline"
            >
              Save
            </button>
          </form>
        );
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
          <div className="text-right text-xs">
            {u.suspendedAt ? (
              <form action={adminUnsuspendUserAction} className="inline">
                <input type="hidden" name="userId" value={u.id} />
                <button type="submit" className="text-primary underline-offset-2 hover:underline">
                  Unsuspend
                </button>
              </form>
            ) : (
              <form action={adminSuspendUserAction} className="inline">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="reason" value="Admin action" />
                <button type="submit" className="text-error underline-offset-2 hover:underline">
                  Suspend
                </button>
              </form>
            )}
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
