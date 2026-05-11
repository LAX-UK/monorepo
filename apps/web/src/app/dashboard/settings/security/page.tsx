import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Security",
};

export default async function SecuritySettingsPage() {
  const meRes = await authedServerFetch("/users/me");
  if (meRes.status === 401) redirect("/login?next=/dashboard/settings/security&auth=required");
  if (!meRes.ok) redirect("/dashboard?error=security");

  const meBody = (await meRes.json()) as {
    data: { deletionRequestedAt?: string | null };
  };
  const deletionRequestedAt = meBody.data.deletionRequestedAt
    ? new Date(meBody.data.deletionRequestedAt)
    : null;

  return (
    <DashboardPage className="mx-auto max-w-md space-y-8">
      <PageHeader
        title="Security"
        description="Update your password and review account access settings."
        className="border-0 pb-0"
        actions={
          <Link
            href="/dashboard/settings/profile"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
          >
            Back to profile
          </Link>
        }
      />
      {deletionRequestedAt ? (
        <Alert>
          <AlertTitle>Deletion requested</AlertTitle>
          <AlertDescription>
            We received your account deletion request on{" "}
            {deletionRequestedAt.toLocaleString("en-GB")}. Our team will process it subject to
            settlement and legal holds.
          </AlertDescription>
        </Alert>
      ) : null}
      <SecurityPasswordForm />
      <Card className="border-outline-variant/15">
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Authenticator (TOTP) is available on your account. Use your authenticator app when
            prompted after sign-in; staff roles may require it once enabled organisation-wide.
          </CardDescription>
        </CardHeader>
        <CardContent className="font-body text-sm text-on-surface-variant">
          Enrolment and verification flows are handled through the sign-in experience; contact
          support if you lose access to your authenticator.
        </CardContent>
      </Card>
      {deletionRequestedAt ? null : (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>Irreversible after processing — see privacy policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      )}
    </DashboardPage>
  );
}
