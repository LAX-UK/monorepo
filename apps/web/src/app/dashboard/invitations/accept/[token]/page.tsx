import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { describeSettingsActionError } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { acceptInvitationAction } from "@/lib/legal-entity/member-management.actions";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AcceptInvitationTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);

  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    return (
      <DashboardPage>
        <OrgModuleComingSoon />
      </DashboardPage>
    );
  }

  const session = await getServerSessionUser();
  if (session?.id) {
    await requireAuthenticatedUser({
      shell: "client",
      loginNext: `/dashboard/invitations/accept/${raw}`,
    });
    const res = await acceptInvitationAction(token);
    if (res.ok) {
      redirect(`/dashboard/organisations/${res.data.legalEntityId}?welcome=1`);
    }
    const failure = {
      ...describeSettingsActionError(res.error ?? "Could not accept invitation."),
      title: "Could not accept invitation",
    };
    return (
      <DashboardPage className="mx-auto max-w-lg space-y-4">
        <DashboardPageHeader
          meta="Invitation"
          title={failure.title}
          hideTitleOnMobile
          hideDescriptionOnMobile
        />
        <DashboardSliceErrorAlert failure={failure} />
        <Button asChild variant="outline">
          <Link href={DASHBOARD_ROUTES.invitations}>Back to invitations</Link>
        </Button>
      </DashboardPage>
    );
  }

  const acceptNext = `/dashboard/invitations/accept/${encodeURIComponent(token)}`;
  const signInHref = buildHostedLoginStartHref({ next: acceptNext });
  const registerHref = buildHostedLoginStartHref({
    next: acceptNext,
    intent: "signup",
    invite: token,
  });

  return (
    <DashboardPage className="mx-auto max-w-lg space-y-6">
      <DashboardPageHeader
        meta="Invitation"
        title="Accept invitation"
        hideTitleOnMobile
        hideDescriptionOnMobile
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
