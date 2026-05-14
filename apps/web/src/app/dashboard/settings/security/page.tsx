import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
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

export const metadata: Metadata = {
  title: "Security",
};

export default async function SecuritySettingsPage() {
  const me = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/security",
  });
  const deletionRequestedAt = me.deletionRequestedAt ? new Date(me.deletionRequestedAt) : null;
  const twoFactorEnabled = me.twoFactorEnabled === true;

  return (
    <DashboardPage className="mx-auto max-w-md space-y-8">
      <PageHeader
        title="Security"
        description="Update your password and review account access settings."
        className="border-0 pb-0"
        actions={
          <Link
            href="/dashboard/settings?tab=security"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
          >
            Back to settings
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
      <TwoFactorStatusCard twoFactorEnabled={twoFactorEnabled} />
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
