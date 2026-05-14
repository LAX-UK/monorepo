import { TwoFactorEnableWizard } from "@/components/auth/two-factor-enable-wizard";
import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Two-factor authentication",
};

export default async function SecurityTwoFactorPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/security/two-factor",
  });

  const enabled = user.twoFactorEnabled === true;

  return (
    <DashboardPage className="mx-auto max-w-md space-y-8">
      <PageHeader
        title="Two-factor authentication"
        description={
          enabled
            ? "Manage backup codes or turn off authenticator sign-in."
            : "Set up an authenticator app in a few steps."
        }
        className="border-0 pb-0"
        actions={
          <Link
            href="/dashboard/settings/security"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
          >
            Back to security
          </Link>
        }
      />
      {enabled ? <TwoFactorStatusCard twoFactorEnabled /> : <TwoFactorEnableWizard />}
    </DashboardPage>
  );
}
