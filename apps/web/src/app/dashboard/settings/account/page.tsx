import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { ReduceMotionCard } from "@/components/settings/reduce-motion-card";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntityStatus } from "@auction/types";
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
import Link from "next/link";
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

  const leRes = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
  const organisations =
    leRes.ok && leRes.status === 200
      ? ((
          (await leRes.json()) as {
            data?: Array<{
              id: string;
              displayName: string;
              kind: string;
              status: LegalEntityStatus;
            }>;
          }
        ).data?.filter((m) => m.kind === "organisation") ?? [])
      : [];

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

      <ReduceMotionCard />

      <Card className="rounded-xl border-outline-variant/15 shadow-none">
        <CardHeader>
          <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em] text-on-surface">
            Organisations
          </CardTitle>
          <CardDescription>Galleries, dealers, and estates you belong to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organisations.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              You don&apos;t belong to any organisations yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {organisations.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/20 px-3 py-2"
                >
                  <span className="font-medium text-on-surface">{o.displayName}</span>
                  <StatusBadge variant={orgStatusVariant(o.status)}>
                    {orgStatusLabel(o.status)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/onboarding/organisation?fresh=1"
            className="inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Add a gallery, dealer, or estate
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function orgStatusLabel(status: LegalEntityStatus): string {
  switch (status) {
    case "lead":
      return "Setup";
    case "docs_requested":
      return "Docs requested";
    case "docs_received":
      return "Docs received";
    case "under_review":
      return "Under review";
    case "connect_pending":
      return "Connect pending";
    case "approved":
      return "Approved";
    case "restricted":
      return "Restricted";
    case "rejected":
      return "Rejected";
    case "archived":
      return "Archived";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function orgStatusVariant(
  status: LegalEntityStatus,
): "success" | "danger" | "warning" | "neutral" | "info" {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "restricted") return "danger";
  if (status === "archived") return "neutral";
  if (status === "lead" || status === "docs_requested") return "warning";
  return "info";
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
