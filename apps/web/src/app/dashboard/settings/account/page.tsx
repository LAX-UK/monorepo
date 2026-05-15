import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/account",
  });

  return (
    <DashboardPage>
      <PageHeader
        title="Account"
        description="Manage your sign-in email and account-level settings."
        className="border-b border-outline-variant/20 pb-5"
      />
      {sp.changed === "1" ? (
        <Alert>
          <AlertTitle>Confirmation sent</AlertTitle>
          <AlertDescription>Check your inbox to confirm the email change.</AlertDescription>
        </Alert>
      ) : null}
      <Card className="rounded-xl border-outline-variant/15 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Current email
          </CardTitle>
          <CardDescription>Used for sign-in, receipts, and auction alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-body text-sm text-on-surface">{user.email}</p>
            <StatusBadge variant={statusVariant(user.emailStatus, user.emailVerified)}>
              {statusLabel(user.emailStatus, user.emailVerified)}
            </StatusBadge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-outline-variant/15 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Change email
          </CardTitle>
          <CardDescription>
            We send confirmation links to your current address and the new address — both must
            confirm before the switch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm
            currentEmail={user.email}
            hasPendingEmailChange={Boolean(user.pendingNewEmail)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-outline-variant/15 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Organisations
          </CardTitle>
          <CardDescription>
            Manage galleries, dealers, and estates you belong to — invites, members, and onboarding
            continue in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild variant="cta" size="sm">
            <Link href="/dashboard/organisations">Open Organisations</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding/organisation?fresh=1">Register organisation</Link>
          </Button>
        </CardContent>
      </Card>
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
