"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { EditableCell } from "@/components/admin/editable-cell";
import { MediaImage } from "@/components/ui/media-image";
import { adminUpdateArtistNameFieldAction } from "@/lib/actions/admin/field-updates";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { AdminArtistListRow } from "@auction/types";
import { Badge, InlineActionMenu } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ArtistActionMenu({
  row,
  canEdit = false,
}: {
  row: AdminArtistListRow;
  canEdit?: boolean;
}) {
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
        ...(canEdit
          ? [
              {
                type: "item" as const,
                label: "Edit",
                onSelect: () => router.push(`/admin/artists/${row.id}/edit`),
              },
            ]
          : []),
        {
          type: "item",
          label: "Copy ID",
          onSelect: () => void navigator.clipboard.writeText(row.id),
        },
      ]}
    />
  );
}

export function artistColumns(canEdit = false): ColumnDef<AdminArtistListRow>[] {
  return [
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
            <EditableCell
              value={a.displayName}
              onSave={(next) => adminUpdateArtistNameFieldAction(a.id, next)}
              className="font-medium"
            />
            <Link href={`/admin/artists/${a.id}`} className="sr-only">
              View {a.displayName}
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
        return <AdminStatusBadge domain="artist" status={st} />;
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
      cell: ({ row }) => <ArtistActionMenu row={row.original} canEdit={canEdit} />,
      enableSorting: false,
    },
  ];
}
