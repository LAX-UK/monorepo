import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { getAdminInvitations } from "@/lib/data/http/invitations.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  let rows: Awaited<ReturnType<typeof getAdminInvitations>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminInvitations();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load invitations.";
  }

  return (
    <AppScreen className="max-w-[640px] space-y-6">
      <PageHeader
        title="Invitations"
        description="Invite staff or clients by email. They complete signup with the link we send (or log in the server console in development)."
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="font-headline text-lg text-on-surface">Send invite</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Email and role are sent through the existing invitation action.
        </p>
        <AdminInviteForm />
      </section>

      <section>
        <h2 className="font-headline text-lg text-on-surface">Sent invitations</h2>
        {rows.length === 0 ? (
          <p className="mt-2 font-body text-sm text-on-surface-variant">No pending invitations.</p>
        ) : (
          <div className="mt-4">
            <AdminInvitationsBoard rows={rows} />
          </div>
        )}
      </section>
    </AppScreen>
  );
}
