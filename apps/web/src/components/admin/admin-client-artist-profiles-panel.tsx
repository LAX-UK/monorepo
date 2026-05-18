import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import type { ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";
import Link from "next/link";

export function AdminClientArtistProfilesPanel({
  userId,
  userName,
  linkedArtists,
}: {
  userId: string;
  userName: string;
  linkedArtists: ArtistProfile[];
}) {
  const newArtistHref = `/admin/artists/new?${new URLSearchParams({
    ownerUserId: userId,
    displayName: userName,
  }).toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-sm text-on-surface-variant">
          Catalogue artist profiles linked to this user as owner (
          <code className="font-mono text-xs">owner_user_id</code>). Attribution on lots still uses{" "}
          <code className="font-mono text-xs">artist_profile</code> — this link is optional
          metadata.
        </p>
        <Link
          href={newArtistHref}
          className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-primary bg-primary px-4 font-label text-xs uppercase tracking-wide text-on-primary"
        >
          Create artist profile for this user
        </Link>
      </div>
      {linkedArtists.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No linked artist profiles yet.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/20 rounded-lg border border-border-hairline bg-surface-container-lowest">
          {linkedArtists.map((a) => {
            const kind = (a.kind ?? "artist") as ArtistKind;
            const status = (a.status ?? "pending") as ArtistStatus;
            const kindMeta = artistKindMeta(kind);
            const st = artistStatusLabel(status);
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-on-surface">{a.displayName}</p>
                  <p className="mt-0.5 font-mono text-xs text-on-surface-variant">/{a.slug}</p>
                  <p className="mt-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                    {kindMeta.badge} · {st.label}
                    {a.archived ? " · Archived" : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/artists/${encodeURIComponent(a.id)}/edit`}
                  className="font-label text-xs uppercase tracking-wide text-primary hover:underline"
                >
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
