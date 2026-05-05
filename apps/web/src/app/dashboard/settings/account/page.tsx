import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { redirect } from "next/navigation";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const sp = await searchParams;
  const meRes = await authedServerFetch("/users/me");
  if (meRes.status === 401) redirect("/login?next=/dashboard/settings/account&auth=required");
  if (!meRes.ok) redirect("/dashboard?error=account");

  const meBody = (await meRes.json()) as {
    data: { email: string; emailStatus?: string; emailVerified?: boolean };
  };
  const user = meBody.data;

  return (
    <div className="space-y-6">
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
            We will send a confirmation link to your current email before switching addresses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm currentEmail={user.email} />
        </CardContent>
      </Card>
    </div>
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
