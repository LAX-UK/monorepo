"use client";

import { UserRoleAction, UserSuspendAction } from "@/components/admin/admin-user-actions";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import type { UserRole } from "@auction/types";
import {
  Button,
  DataTable,
  EntityTableShell,
  InlineActionMenu,
  KpiTile,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatStrip,
} from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

export type AdminUsersKpiStrip = {
  totalMatches: number;
  adminsOnPage: number;
  suspendedOnPage: number;
  pageCount: number;
};

function userColumns(onOpen: (u: AdminUserRow) => void): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          type="button"
          className="max-w-[12rem] truncate text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-[14rem] truncate text-xs">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
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
          <div className="flex justify-end gap-2">
            <InlineActionMenu
              label={`Actions for ${u.name}`}
              items={[
                {
                  type: "item",
                  label: "Open details",
                  onSelect: () => onOpen(u),
                },
                {
                  type: "item",
                  label: "Copy user ID",
                  onSelect: () => {
                    void navigator.clipboard.writeText(u.id);
                  },
                },
              ]}
            />
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}

function UserDrawerContent({ u }: { u: AdminUserRow }) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Name</dt>
          <dd className="font-headline text-lg">{u.name}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Email</dt>
          <dd className="break-all">{u.email}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">User ID</dt>
          <dd className="font-mono text-xs break-all">{u.id}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Created</dt>
          <dd className="text-xs text-on-surface-variant">{u.createdAt}</dd>
        </div>
      </dl>

      <div className="space-y-4 border-t border-outline-variant/15 pt-4">
        <p className="font-label text-xs uppercase tracking-widest text-secondary">Role</p>
        <UserRoleAction userId={u.id} defaultRole={u.role as UserRole} layout="block" />
      </div>

      <div className="border-t border-outline-variant/15 pt-4">
        <UserSuspendAction userId={u.id} suspendedAt={u.suspendedAt} fullWidthButton />
      </div>
    </div>
  );
}

type Props = {
  rows: AdminUserRow[];
  kpis: AdminUsersKpiStrip;
  roleChips: React.ReactNode;
};

export function AdminUsersBoard({ rows, kpis, roleChips }: Props) {
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [q, setQ] = useState("");
  const onOpen = useCallback((u: AdminUserRow) => setSelected(u), []);
  const columns = useMemo(() => userColumns(onOpen), [onOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const cards = (
    <ul className="space-y-3">
      {filtered.map((u) => (
        <li
          key={u.id}
          className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest/80 p-4 shadow-sm"
        >
          <button type="button" className="w-full text-left" onClick={() => setSelected(u)}>
            <p className="font-headline text-base text-on-surface">{u.name}</p>
            <p className="mt-1 truncate text-xs text-on-surface-variant">{u.email}</p>
            <p className="mt-2 font-label text-[10px] uppercase text-secondary">
              {u.role} · {u.suspendedAt ? "Suspended" : "Active"}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <StatStrip className="mb-2">
        <KpiTile label="Total (server)" value={kpis.totalMatches} />
        <KpiTile label="On this page" value={kpis.pageCount} />
        <KpiTile label="Admins (page)" value={kpis.adminsOnPage} />
        <KpiTile label="Suspended (page)" value={kpis.suspendedOnPage} />
      </StatStrip>

      <EntityTableShell
        responsiveMode="auto"
        filters={roleChips}
        search={
          <div className="grid w-full min-w-0 flex-1 gap-1 sm:max-w-md">
            <label htmlFor="admin-users-q" className="font-label text-xs uppercase tracking-widest text-secondary">
              Filter loaded rows
            </label>
            <input
              id="admin-users-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, or ID…"
              className="min-h-11 rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-base text-on-surface md:text-sm"
            />
          </div>
        }
        table={
          <DataTable columns={columns} data={filtered} emptyMessage="No users match this filter." />
        }
        cards={cards}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>User</SheetTitle>
                <SheetDescription>Role changes and suspension from one touch-friendly panel.</SheetDescription>
              </SheetHeader>
              <UserDrawerContent u={selected} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
