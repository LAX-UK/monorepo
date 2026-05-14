import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { invitationsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; limit?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = invitationsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof invitationsListController.fetch>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await invitationsListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load invitations.";
  }

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const inviteSection = (
    <section className="mx-auto max-w-[640px] rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
      <h2 className="font-headline text-lg text-on-surface">Send invite</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Email and role are sent through the existing invitation action.
      </p>
      <AdminInviteForm />
    </section>
  );

  const listSection = (
    <section className="mx-auto max-w-[640px] space-y-4">
      <h2 className="font-headline text-lg text-on-surface">Sent invitations</h2>
      {total === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No pending invitations.</p>
      ) : rows.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
      ) : (
        <AdminInvitationsBoard rows={rows} />
      )}
    </section>
  );

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/invitations", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/invitations", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  const view = (
    <div className="space-y-8">
      {inviteSection}
      {listSection}
    </div>
  );

  return (
    <AdminListPage
      title="Invitations"
      description="Invite staff or clients by email. They complete signup with the link we send (or log in the server console in development)."
      errorAlert={errorAlert}
      view={view}
      pagination={pagination}
    />
  );
}
