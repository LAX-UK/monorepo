import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { adminResendInvitationAction, adminRevokeInvitationAction } from "@/lib/actions/admin";
import { getAdminInvitations } from "@/lib/data/http/invitations.server";
import type { UserRole } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";

function roleLabel(r: UserRole): string {
  if (r === "administrator") return "Administrator";
  if (r === "accountant") return "Accountant";
  return "Client";
}

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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
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

      <section className="rounded-sm border border-outline-variant/15 bg-surface-container-lowest p-6">
        <h2 className="font-headline text-lg text-on-surface">New invitation</h2>
        <AdminInviteForm />
      </section>

      <section>
        <h2 className="font-headline text-lg text-on-surface">Pending</h2>
        {rows.length === 0 ? (
          <p className="mt-2 font-body text-sm text-on-surface-variant">No pending invitations.</p>
        ) : (
          <ul className="mt-4 divide-y divide-outline-variant/15 rounded-sm border border-outline-variant/15">
            {rows.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-on-surface">{inv.email}</p>
                  <p className="font-body text-xs text-on-surface-variant">
                    {roleLabel(inv.targetRole)} · expires {inv.expiresAt.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={adminResendInvitationAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="font-label text-[10px] uppercase"
                    >
                      Resend
                    </Button>
                  </form>
                  <form action={adminRevokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="font-label text-[10px] uppercase"
                    >
                      Revoke
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
