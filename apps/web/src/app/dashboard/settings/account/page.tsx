import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const sp = await searchParams;
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/account",
  });

  return (
    <DashboardPage className="space-y-6">
      <SettingsFormHeader
        title="Account"
        description="Manage your sign-in email and account-level settings."
      />
      {sp.changed === "1" ? (
        <Alert>
          <AlertTitle>Confirmation sent</AlertTitle>
          <AlertDescription>Check your inbox to confirm the email change.</AlertDescription>
        </Alert>
      ) : null}
      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Current email
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Used for sign-in, receipts, and auction alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-body text-sm text-on-surface">{user.email}</p>
          <StatusBadge variant={statusVariant(user.emailStatus, user.emailVerified)}>
            {statusLabel(user.emailStatus, user.emailVerified)}
          </StatusBadge>
        </div>
      </Surface>

      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Change email
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            We send confirmation links to your current address and the new address — both must
            confirm before the switch.
          </p>
        </div>
        <ChangeEmailForm
          currentEmail={user.email}
          hasPendingEmailChange={Boolean(user.pendingNewEmail)}
        />
      </Surface>

      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Organisations
          </h2>
          {orgModuleEnabled ? (
            <p className="font-body text-sm text-on-surface-variant">
              Manage galleries, dealers, and estates you belong to — invites, members, and
              onboarding continue in one place.
            </p>
          ) : (
            <p className="font-body text-sm text-on-surface-variant">
              {DASHBOARD_EMPTY.orgModuleComingSoon.description}
            </p>
          )}
        </div>
        {orgModuleEnabled ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild variant="cta" size="sm">
              <Link href="/dashboard/organisations">Open Organisations</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding/organisation?fresh=1">Register organisation</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild variant="cta" size="sm">
              <Link href="/contact">Contact us</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
            </Button>
          </div>
        )}
      </Surface>
    </DashboardPage>
  );
}

function statusLabel(status: string | undefined, verified: boolean | undefined): string {
  if (status === "bounced") return "Bounced";
  if (status === "complained") return "Complained";
  if (verified === false) return "Unverified";
  return "Verified";
}

function statusVariant(
  status: string | undefined,
  verified: boolean | undefined,
): "success" | "danger" | "warning" {
  if (status === "bounced" || status === "complained") return "danger";
  if (verified === false) return "warning";
  return "success";
}
