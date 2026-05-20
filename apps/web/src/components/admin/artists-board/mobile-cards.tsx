"use client";

import { ArtistActionMenu } from "@/components/admin/artists-board/columns";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { AdminArtistListRow } from "@auction/types";
import { Badge } from "@auction/ui";
import Link from "next/link";

type Props = {
  artists: AdminArtistListRow[];
};

export function ArtistsMobileCards({ artists }: Props) {
  return (
    <ul className="space-y-3">
      {artists.map((a) => {
        const lifeRaw = formatArtistLifespan({
          birthYear: a.birthYear,
          deathYear: a.deathYear,
        });
        const life = lifeRaw === "—" ? null : lifeRaw;
        return (
          <li
            key={a.id}
            className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
          >
            <div className="flex items-start gap-3">
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
                  <ArtistActionMenu row={a} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
