import { UserRoleAction, UserSuspendAction } from "@/components/admin/admin-user-actions";
import { DisplayHeading } from "@/components/ui/typography";
import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import { getAdminArtistsByOwnerUserId, getAdminUserById } from "@/lib/data/http/admin.server";
import type { ArtistKind, ArtistStatus, UserRole } from "@auction/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getAdminUserById>> = null;
  try {
    user = await getAdminUserById(id);
  } catch {
    user = null;
  }
  if (!user) notFound();

  const linkedArtists = await getAdminArtistsByOwnerUserId(user.id).catch(() => []);
  const newArtistHref = `/admin/artists/new?${new URLSearchParams({
    ownerUserId: user.id,
    displayName: user.name,
  }).toString()}`;

  return (
    <div className="screen w-full space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex min-h-11 items-center font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Users
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-widest text-secondary">User</p>
          <DisplayHeading as="h1" className="mt-2 text-4xl">
            {user.name}
          </DisplayHeading>
          <p className="mt-2 font-body text-sm text-on-surface-variant">{user.email}</p>
          <p className="mt-1 font-mono text-xs text-on-surface-variant">{user.id}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex h-auto min-h-11 flex-wrap justify-start gap-1 bg-surface-container-low p-1">
          <TabsTrigger value="profile" className="font-label text-[11px] uppercase tracking-wide">
            Profile
          </TabsTrigger>
          <TabsTrigger value="activity" className="font-label text-[11px] uppercase tracking-wide">
            Activity
          </TabsTrigger>
          <TabsTrigger value="commerce" className="font-label text-[11px] uppercase tracking-wide">
            Commerce
          </TabsTrigger>
          <TabsTrigger value="notes" className="font-label text-[11px] uppercase tracking-wide">
            Notes
          </TabsTrigger>
          <TabsTrigger value="artists" className="font-label text-[11px] uppercase tracking-wide">
            Artist profiles
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="profile"
          className="mt-6 space-y-8 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6"
        >
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Created</dt>
              <dd>{user.createdAt}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
              <dd>{user.suspendedAt ? `Suspended · ${user.suspendedAt}` : "Active"}</dd>
            </div>
            {user.suspendedReason ? (
              <div className="md:col-span-2">
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Suspension reason
                </dt>
                <dd className="text-error">{user.suspendedReason}</dd>
              </div>
            ) : null}
          </dl>
          <div className="space-y-4 border-t border-outline-variant/15 pt-6">
            <p className="font-label text-xs uppercase tracking-widest text-secondary">Role</p>
            <UserRoleAction userId={user.id} defaultRole={user.role as UserRole} layout="block" />
          </div>
          <div className="border-t border-outline-variant/15 pt-6">
            <UserSuspendAction userId={user.id} suspendedAt={user.suspendedAt} fullWidthButton />
          </div>
        </TabsContent>
        <TabsContent
          value="activity"
          className="mt-6 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant"
        >
          Bid history, submissions, watchlists, and notifications will hydrate from scoped admin
          APIs (Phase 1.4 backlog).
        </TabsContent>
        <TabsContent
          value="commerce"
          className="mt-6 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant"
        >
          Payments, invoices, and addresses surface once accountant endpoints expose cross-links.
        </TabsContent>
        <TabsContent
          value="notes"
          className="mt-6 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant"
        >
          Internal notes & tags require user_note / user_tag migrations before collaborative
          workflows unlock.
        </TabsContent>
        <TabsContent
          value="artists"
          className="mt-6 space-y-6 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-sm text-on-surface-variant">
              Catalogue artist profiles linked to this user as owner (
              <code className="font-mono text-xs">owner_user_id</code>). Attribution on lots still
              uses <code className="font-mono text-xs">artist_profile</code> — this link is optional
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
            <ul className="divide-y divide-outline-variant/20 rounded-lg border border-outline-variant/20 bg-surface-container-lowest">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
