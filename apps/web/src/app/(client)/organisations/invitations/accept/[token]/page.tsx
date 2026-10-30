import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { InvitationLinkState } from "@/components/organisations/invitation-link-state";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { createInvitationLinkGateway } from "@/lib/legal-entity/invitation-link.gateway.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { invitationAcceptAction, invitationLinkPath } from "@/lib/navigation/invitation-link";
import { buildInvitationLinkView } from "@/lib/organisations/invitation-link.vm";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { LogIn, UserPlus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * An organisation invitation link. Opening it changes nothing: a signed-in person reads what
 * the invitation is (or what became of it) and accepts with a button, which posts to the
 * `confirm` route handler.
 */
export default async function AcceptInvitationTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [{ token: raw }, { error }] = await Promise.all([params, searchParams]);
  const token = decodeURIComponent(raw);
  const pagePath = invitationLinkPath(token);

  if (!(await resolveOrgModuleEnabledFromRequest())) {
    return (
      <DashboardPage>
        <OrgModuleComingSoon />
      </DashboardPage>
    );
  }

  const session = await getServerSessionUser();
  if (session?.id) {
    const preview = await createInvitationLinkGateway().preview(token);
    const view = buildInvitationLinkView({
      preview,
      pagePath,
      failedBefore: error === "unavailable",
    });
    return (
      <DashboardPage>
        <InvitationLinkState view={view} acceptAction={invitationAcceptAction(token)} />
      </DashboardPage>
    );
  }

  const signInHref = buildHostedLoginStartHref({ next: pagePath });
  const registerHref = buildHostedLoginStartHref({
    next: pagePath,
    intent: "signup",
    invite: token,
  });

  return (
    <DashboardPage className="mx-auto max-w-lg space-y-6">
      <DashboardPageHeader
        meta="Invitation"
        title="Accept invitation"
        description="Sign in or create an account with the invited email to join this organisation."
      />
      <Surface variant="section" padding="md" className="space-y-4">
        <div>
          <p className="font-headline text-base font-semibold text-on-surface">
            Choose how to continue
          </p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Use the email address this invitation was sent to.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="cta" className="h-auto min-h-24 flex-col gap-2 py-4">
            <a href={registerHref}>
              <UserPlus className="size-6" aria-hidden />
              <span>Create account</span>
            </a>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-24 flex-col gap-2 py-4">
            <a href={signInHref}>
              <LogIn className="size-6" aria-hidden />
              <span>Sign in</span>
            </a>
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href={signInHref}>Back to sign in</a>
        </Button>
      </Surface>
    </DashboardPage>
  );
}
