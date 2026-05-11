import { AppScreen } from "@/components/dashboard/dashboard-page";
import { Button } from "@/components/ui/button";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Badge } from "@auction/ui/components/badge";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ includeArchived?: string; q?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.includeArchived === "true";
  const q = sp.q?.trim().slice(0, 200);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  let artists: Awaited<ReturnType<typeof getAdminArtistList>> = [];
  let loadError: string | null = null;

  try {
    artists = await getAdminArtistList({ includeArchived, ...(q ? { q } : {}) });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load artists.";
  }

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Artists"
        description="Manage canonical public artist profiles, client ownership links, featured state, and attribution targets."
        actions={
          <Button variant="primary" asChild>
            <Link href="/admin/artists/new">
              <Plus className="size-4" aria-hidden />
              New artist
            </Link>
          </Button>
        }
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load artists</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError && artists.length === 0 ? (
        <EmptyState
          title="No artists yet"
          description="Create canonical profiles before assigning artist attribution to lots."
          action={
            <Button variant="primary" asChild>
              <Link href="/admin/artists/new">New artist</Link>
            </Button>
          }
        />
      ) : null}

      {!loadError && artists.length > 0 ? (
        <div className="grid gap-3">
          {artists.map((artist) => (
            <article
              key={artist.id}
              className="rounded-lg border border-outline-variant/20 bg-surface-container-low/30 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/artists/${artist.id}/edit`}
                    className="font-headline text-lg text-on-surface hover:text-primary"
                  >
                    {artist.displayName}
                  </Link>
                  <p className="mt-1 font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
                    /{artist.slug}
                    {artist.ownerUserId
                      ? ` · linked user ${artist.ownerUserId.slice(0, 8)}...`
                      : ""}
                  </p>
                  {artist.shortBio ? (
                    <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                      {artist.shortBio}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {artist.featured ? <Badge>Featured</Badge> : null}
                  {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
                  {artist.archived ? <Badge variant="outline">Archived</Badge> : null}
                  <Button variant="secondary" asChild>
                    <Link href={`/admin/artists/${artist.id}/edit`}>Edit</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </AppScreen>
  );
}
