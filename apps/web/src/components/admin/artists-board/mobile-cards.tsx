"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { ArtistActionMenu } from "@/components/admin/artists-board/columns";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { AdminArtistListRow } from "@auction/types";
import { Badge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";

type Props = {
  artists: AdminArtistListRow[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
};

export function ArtistsMobileCards({ artists, rowSelection, onRowSelectionChange }: Props) {
  return (
    <CatalogVirtualizedList itemCount={artists.length}>
      {artists.map((a) => {
        const lifeRaw = formatArtistLifespan({
          birthYear: a.birthYear,
          deathYear: a.deathYear,
        });
        const life = lifeRaw === "—" ? null : lifeRaw;

        return (
          <CatalogMobileCardShell
            key={a.id}
            id={a.id}
            title={a.displayName}
            selected={rowSelection?.[a.id]}
            onSelectedChange={
              onRowSelectionChange
                ? (checked) => {
                    onRowSelectionChange((prev) => ({
                      ...prev,
                      [a.id]: checked,
                    }));
                  }
                : undefined
            }
            selectionLabel={`Select ${a.displayName}`}
            trailing={<ArtistActionMenu row={a} />}
            footer={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                  <Link href={`/admin/artists/${a.id}/edit`}>Edit</Link>
                </Button>
                <Button variant="secondary" size="sm" className="min-h-11 flex-1" asChild>
                  <Link href={`/admin/artists/${a.id}`}>Open</Link>
                </Button>
              </div>
            }
          >
            <Link href={`/admin/artists/${a.id}`} className="font-headline text-sm text-primary">
              {a.displayName}
            </Link>
            <p className="font-label text-[10px] uppercase text-on-surface-variant">
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
            {a.status ? (
              <div className="mt-2">
                <AdminStatusBadge domain="artist" status={a.status} />
              </div>
            ) : null}
          </CatalogMobileCardShell>
        );
      })}
    </CatalogVirtualizedList>
  );
}
