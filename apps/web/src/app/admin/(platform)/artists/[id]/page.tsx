import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { artistPath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminArtistDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, lots, dupes] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 50 }).catch(() => []),
    getAdminArtistDuplicateCandidates(id).catch(() => []),
  ]);
  if (!artist) notFound();

  const lifeRaw = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const life = lifeRaw === "—" ? null : lifeRaw;
  const st = artist.status ? artistStatusLabel(artist.status) : null;
  const publicHref = artistPath({ id: artist.id, name: artist.displayName });

  const mergedBanner =
    artist.status === "merged_into" && artist.mergedIntoArtistId ? (
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-4 text-sm text-on-surface">
        This profile was merged into{" "}
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="font-medium text-primary hover:underline"
        >
          {artist.mergedIntoArtistId}
        </Link>
        . Prefer the surviving profile for edits and catalogue work.
      </div>
    ) : null;

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <div className="flex flex-wrap gap-3 font-label text-xs uppercase tracking-widest">
          <Link href="/admin/artists" className="text-primary hover:underline">
            ← Artists
          </Link>
          <span className="text-on-surface-variant">/</span>
          <span className="text-on-surface">{artist.displayName}</span>
        </div>
      }
      title={artist.displayName}
      description={life ? `${life} · Registry overview` : "Registry overview"}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {artist.kind ? (
            <Badge variant="secondary">{artistKindMeta(artist.kind).badge}</Badge>
          ) : null}
          {st ? (
            <Badge
              variant={
                st.tone === "success"
                  ? "default"
                  : st.tone === "warning"
                    ? "secondary"
                    : st.tone === "danger"
                      ? "destructive"
                      : "outline"
              }
            >
              {st.label}
            </Badge>
          ) : null}
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/artists/${artist.id}/edit`}>Edit</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={publicHref} target="_blank" rel="noopener noreferrer">
              Public profile
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/audit/timeline">Audit timeline</Link>
          </Button>
        </div>
      }
    >
      {mergedBanner}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
          <p>
            <span className="font-medium text-on-surface">Slug</span>
            <br />
            <span className="font-mono text-xs">/{artist.slug}</span>
          </p>
          <p>
            <span className="font-medium text-on-surface">Nationality</span>
            <br />
            {artist.nationality?.trim() || "—"}
          </p>
          <p>
            <span className="font-medium text-on-surface">Featured / verified</span>
            <br />
            {artist.featured ? "Featured" : "Not featured"}
            {" · "}
            {artist.verified ? "Verified" : "Not verified"}
          </p>
          <p>
            <span className="font-medium text-on-surface">Archived</span>
            <br />
            {artist.archived ? "Yes" : "No"}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3" id="lots">
        <h2 className="font-display text-xl font-semibold tracking-tight">Lots</h2>
        <p className="text-sm text-on-surface-variant">
          Read-only FK attribution. Reassign from each lot&apos;s edit screen.
        </p>
        <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
      </section>

      <section className="space-y-3" id="duplicates">
        <h2 className="font-display text-xl font-semibold tracking-tight">Duplicates & merge</h2>
        <p className="text-sm text-on-surface-variant">
          Server-suggested candidates with similar names. Merging moves aliases and lots to the
          surviving profile.
        </p>
        {dupes.length === 0 ? (
          <p className="rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            No duplicate candidates returned for this profile.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-outline-variant/30">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-lowest text-left font-label text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {dupes.map((d) => (
                  <tr key={d.id} className="border-t border-outline-variant/15">
                    <td className="px-4 py-2 font-medium text-on-surface">{d.displayName}</td>
                    <td className="px-4 py-2 text-on-surface-variant">{d.kind}</td>
                    <td className="px-4 py-2 text-on-surface-variant">{d.status}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/artists/${d.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminArtistMergePanel fromArtistId={artist.id} fromDisplayName={artist.displayName} />
      </section>
    </AdminEntityDetailShell>
  );
}
