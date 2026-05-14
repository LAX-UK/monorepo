"use client";

import { useTableDensity } from "@/components/layout/density-provider";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { artistStatusLabel } from "@/lib/artists/kind-presenter";
import type { ArtistProfile } from "@auction/types";
import { Badge, DataTable, EmptyState, EntityTableShell, InlineActionMenu } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

type ArtistRow = Pick<
  ArtistProfile,
  "id" | "displayName" | "slug" | "kind" | "status" | "featured" | "verified" | "archived"
>;

function artistColumns(): ColumnDef<ArtistRow>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/admin/artists/${row.original.id}/edit`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.displayName}
        </Link>
      ),
    },
    {
      accessorKey: "slug",
      header: "Slug",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface-variant">/{row.original.slug}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <span className="text-sm text-on-surface-variant">{row.original.kind ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="text-sm text-on-surface-variant">
          {row.original.status ? artistStatusLabel(row.original.status).label : "—"}
        </span>
      ),
    },
    {
      id: "badges",
      header: "Flags",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.featured ? <Badge>Featured</Badge> : null}
          {row.original.verified ? <Badge variant="secondary">Verified</Badge> : null}
          {row.original.archived ? <Badge variant="outline">Archived</Badge> : null}
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <InlineActionMenu
          label={`Actions for ${row.original.displayName}`}
          items={[
            {
              type: "item",
              label: "Edit",
              onSelect: () => {
                window.location.href = `/admin/artists/${row.original.id}/edit`;
              },
            },
            {
              type: "item",
              label: "Copy ID",
              onSelect: () => void navigator.clipboard.writeText(row.original.id),
            },
          ]}
        />
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  artists: ArtistRow[];
  searchQuery?: string | undefined;
  hasFilters?: boolean | undefined;
};

export function AdminArtistsBoard({ artists, hasFilters }: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => artistColumns(), []);

  if (artists.length === 0) {
    return (
      <EmptyState
        title={hasFilters ? "No matching artists" : "No artists yet"}
        description={
          hasFilters
            ? "Clear the search or filters to broaden the list."
            : "Create canonical profiles before assigning artist attribution to lots."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/artists">Clear filters</Link>
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <Link href="/admin/artists/new">New artist</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <EntityTableShell
      density={density}
      responsiveMode="auto"
      table={
        <TableScroll>
          <DataTable columns={columns} data={artists} getRowId={(r) => r.id} density={density} />
        </TableScroll>
      }
      cards={
        <ul className="space-y-3">
          {artists.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-outline-variant/15 bg-surface-container-low/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/artists/${a.id}/edit`}
                    className="font-headline text-sm text-primary"
                  >
                    {a.displayName}
                  </Link>
                  <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                    /{a.slug}
                    {a.kind ? ` · ${a.kind}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.featured ? <Badge>Featured</Badge> : null}
                    {a.verified ? <Badge variant="secondary">Verified</Badge> : null}
                    {a.archived ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                </div>
                <InlineActionMenu
                  label={`Actions for ${a.displayName}`}
                  items={[
                    {
                      type: "item",
                      label: "Edit",
                      onSelect: () => {
                        window.location.href = `/admin/artists/${a.id}/edit`;
                      },
                    },
                    {
                      type: "item",
                      label: "Copy ID",
                      onSelect: () => void navigator.clipboard.writeText(a.id),
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      }
    />
  );
}
