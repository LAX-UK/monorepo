import { AuthLayout } from "@/components/auth/auth-layout";
import { AcceptStaffInvitationButton } from "@/components/invitations/accept-staff-invitation-button";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { fetchInvitePreview } from "@/lib/auth/invite-preview.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { laxStaffPlatform, laxStaffRoleOption } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Accept invitation",
  "Accept access to London Art Exchange platforms with your LAX account.",
);

const UNAVAILABLE_COPY = {
  invalid: "This invitation is no longer valid. It may have been accepted or withdrawn.",
  expired: "This invitation has expired. Ask the person who invited you to send a new one.",
  unavailable: "We couldn't load this invitation right now. Refresh the page to try again.",
} as const;

export default async function AcceptStaffInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const selfPath = `/invitations/accept/${encodeURIComponent(token)}`;
  const [preview, session] = await Promise.all([fetchInvitePreview(token), getServerSessionUser()]);

  if (!preview.ok) {
    return (
      <main id="main-content">
        <AuthLayout chrome="task" title="Invitation unavailable">
          <Alert variant="warning">
            <AlertDescription>{UNAVAILABLE_COPY[preview.reason]}</AlertDescription>
          </Alert>
        </AuthLayout>
      </main>
    );
  }

  const grants = preview.preview.grants ?? [];
  const invitedEmail = preview.preview.email;
  const signedInAsOther =
    session != null && session.email.trim().toLowerCase() !== invitedEmail.trim().toLowerCase();

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="You've been given access"
        description={`This invitation is for ${invitedEmail}. You use one LAX account on every platform.`}
      >
        <div className="space-y-5">
          <ul className="m-0 grid list-none gap-2 p-0">
            {grants.map((grant) => {
              const role = laxStaffRoleOption(grant.product, grant.role);
              return (
                <li
                  key={grant.product}
                  className="rounded-lg border border-border-soft bg-surface-container-lowest p-3"
                >
                  <p className="font-body text-sm font-semibold text-on-surface">
                    {laxStaffPlatform(grant.product).label} · {role?.label ?? grant.role}
                  </p>
                  {role ? (
                    <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                      {role.summary}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {session == null ? (
            <div className="grid gap-3">
              <Button asChild variant="cta" className="min-h-11">
                <a href={buildHostedLoginStartHref({ next: selfPath })}>Sign in to accept</a>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <a
                  href={buildHostedLoginStartHref({
                    next: selfPath,
                    intent: "signup",
                    invite: token,
                  })}
                >
                  Create a LAX account
                </a>
              </Button>
            </div>
          ) : signedInAsOther ? (
            <div className="grid gap-3">
              <Alert variant="warning">
                <AlertTitle>Signed in with a different account</AlertTitle>
                <AlertDescription>
                  You&apos;re signed in as {session.email}. Switch to {invitedEmail} to accept.
                </AlertDescription>
              </Alert>
              <Button asChild variant="cta" className="min-h-11">
                <a href={buildHostedLoginStartHref({ next: selfPath, forceLoginPrompt: true })}>
                  Switch account
                </a>
              </Button>
            </div>
          ) : (
            <AcceptStaffInvitationButton token={token} />
          )}
        </div>
      </AuthLayout>
    </main>
  );
}
