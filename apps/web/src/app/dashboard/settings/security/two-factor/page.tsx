import { TwoFactorEnableWizard } from "@/components/auth/two-factor-enable-wizard";
import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { SETTINGS_NARROW_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
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

  return (
    <DashboardPage className={`space-y-8 ${SETTINGS_NARROW_MAX_WIDTH}`}>
      <SettingsFormHeader
        title="Two-factor authentication"
        actions={
          <Link
            href="/dashboard/settings/security"
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-2 hover:underline"
          >
            Back to security
          </Link>
        }
      />
      {user.securityStatusAvailable === true ? (
        user.twoFactorEnabled === true ? (
          <TwoFactorStatusCard twoFactorEnabled />
        ) : (
          <TwoFactorEnableWizard />
        )
      ) : (
        <Alert>
          <AlertTitle>Two-factor status unavailable</AlertTitle>
          <AlertDescription>
            We could not load your current two-factor authentication status. Try again later before
            changing this setting.
          </AlertDescription>
        </Alert>
      )}
    </DashboardPage>
  );
}
