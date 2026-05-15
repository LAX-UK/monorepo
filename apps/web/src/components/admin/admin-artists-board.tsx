"use client";

import { AdminArtistsBulkBar } from "@/components/admin/admin-artists-bulk-bar";
import { useTableDensity } from "@/components/layout/density-provider";
import { MediaImage } from "@/components/ui/media-image";
import { TableScroll } from "@/components/ui/table-scroll";
import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { AdminArtistListRow } from "@auction/types";
import { Badge, DataTable, EntityTableShell, InlineActionMenu } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

function ArtistActionMenu({ row }: { row: AdminArtistListRow }) {
  const router = useRouter();
  return (
    <InlineActionMenu
      label={`Actions for ${row.displayName}`}
      items={[
        {
          type: "item",
          label: "View",
          onSelect: () => router.push(`/admin/artists/${row.id}`),
        },
        {
          type: "item",
          label: "Edit",
          onSelect: () => router.push(`/admin/artists/${row.id}/edit`),
        },
        {
          type: "item",
          label: "Copy ID",
          onSelect: () => void navigator.clipboard.writeText(row.id),
        },
      ]}
    />
  );
}

function artistColumns(
  selected: Set<string>,
  onToggle: (id: string) => void,
  onTogglePage: (ids: string[], checked: boolean) => void,
  pageIds: string[],
): ColumnDef<AdminArtistListRow>[] {
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  return [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          className="size-4 rounded border-outline-variant accent-primary"
          checked={allOnPage}
          ref={(el) => {
            if (el) el.indeterminate = !allOnPage && someOnPage;
          }}
          onChange={(e) => onTogglePage(pageIds, e.target.checked)}
          aria-label="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="size-4 rounded border-outline-variant accent-primary"
          checked={selected.has(row.original.id)}
          onChange={() => onToggle(row.original.id)}
          aria-label={`Select ${row.original.displayName}`}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "displayName",
      header: "Artist",
      cell: ({ row }) => {
        const a = row.original;
        const lifeRaw = formatArtistLifespan({
          birthYear: a.birthYear,
          deathYear: a.deathYear,
        });
        const life = lifeRaw === "—" ? null : lifeRaw;
        return (
          <div className="min-w-0">
            <Link
              href={`/admin/artists/${a.id}`}
              className="font-medium text-primary hover:underline"
            >
              {a.displayName}
            </Link>
            <p className="truncate font-mono text-[11px] text-on-surface-variant">/{a.slug}</p>
            {life ? (
              <p className="mt-0.5 font-body text-xs text-on-surface-variant">{life}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => {
        const k = row.original.kind;
        if (!k) return <span className="text-sm text-on-surface-variant">—</span>;
        const meta = artistKindMeta(k);
        return <Badge variant="secondary">{meta.badge}</Badge>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const st = row.original.status;
        if (!st) return <span className="text-sm text-on-surface-variant">—</span>;
        const { label, tone } = artistStatusLabel(st);
        const variant =
          tone === "success"
            ? "default"
            : tone === "warning"
              ? "secondary"
              : tone === "danger"
                ? "destructive"
                : "outline";
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      id: "lots",
      header: "Lots",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-on-surface">{row.original.lotCount}</span>
      ),
    },
    {
      id: "aliases",
      header: "Aliases",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-on-surface">{row.original.aliasCount}</span>
      ),
    },
    {
      id: "owner",
      header: "Linked owner",
      cell: ({ row }) => {
        const a = row.original;
        if (!a.ownerDisplayName) {
          return <span className="text-sm text-on-surface-variant">—</span>;
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            {a.ownerImage ? (
              <MediaImage
                src={a.ownerImage}
                alt=""
                shape="circle"
                className="size-7 shrink-0"
                sizes="28px"
              />
            ) : null}
            <span className="truncate text-sm text-on-surface">{a.ownerDisplayName}</span>
          </div>
        );
      },
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
      cell: ({ row }) => <ArtistActionMenu row={row.original} />,
      enableSorting: false,
    },
  ];
}

type Props = {
  artists: AdminArtistListRow[];
  searchQuery?: string | undefined;
};

export function AdminArtistsBoard({ artists }: Props) {
  const { density } = useTableDensity();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = useMemo(() => artists.map((a) => a.id), [artists]);

  const onToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onTogglePage = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const columns = useMemo(
    () => artistColumns(selected, onToggle, onTogglePage, pageIds),
    [selected, onToggle, onTogglePage, pageIds],
  );

  if (artists.length === 0) {
    return null;
  }

  const selectedIds = artists.filter((a) => selected.has(a.id)).map((a) => a.id);

  return (
    <div className="space-y-4">
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
            {artists.map((a) => {
              const lifeRaw = formatArtistLifespan({
                birthYear: a.birthYear,
                deathYear: a.deathYear,
              });
              const life = lifeRaw === "—" ? null : lifeRaw;
              const checked = selected.has(a.id);
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-outline-variant/15 bg-surface-container-low/30 p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-outline-variant accent-primary"
                      checked={checked}
                      onChange={() => onToggle(a.id)}
                      aria-label={`Select ${a.displayName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/artists/${a.id}`}
                            className="font-headline text-sm text-primary"
                          >
                            {a.displayName}
                          </Link>
                          <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                            /{a.slug}
                            {a.kind ? ` · ${artistKindMeta(a.kind).badge}` : ""}
                            {life ? ` · ${life}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {a.featured ? <Badge>Featured</Badge> : null}
                            {a.verified ? <Badge variant="secondary">Verified</Badge> : null}
                            {a.archived ? <Badge variant="outline">Archived</Badge> : null}
                          </div>
                          <p className="mt-2 font-body text-xs text-on-surface-variant">
                            Lots <span className="tabular-nums">{a.lotCount}</span>
                            {" · "}
                            Aliases <span className="tabular-nums">{a.aliasCount}</span>
                          </p>
                        </div>
                        <InlineActionMenu
                          label={`Actions for ${a.displayName}`}
                          items={[
                            {
                              type: "item",
                              label: "View",
                              onSelect: () => {
                                router.push(`/admin/artists/${a.id}`);
                              },
                            },
                            {
                              type: "item",
                              label: "Edit",
                              onSelect: () => {
                                router.push(`/admin/artists/${a.id}/edit`);
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
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        }
      />
      <AdminArtistsBulkBar
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        onClear={clearSelection}
      />
    </div>
  );
}
