import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { SecurityAccountMethods } from "@/components/settings/security-account-methods";
import { SecuritySettingsAlerts } from "@/components/settings/security-settings-alerts";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { SETTINGS_NARROW_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Security",
};

export default async function SecuritySettingsPage() {
  const me = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/security",
  });
  const deletionRequestedAt = me.deletionRequestedAt ? new Date(me.deletionRequestedAt) : null;
  return (
    <DashboardPage className={`space-y-6 ${SETTINGS_NARROW_MAX_WIDTH}`}>
      <SettingsFormHeader
        title="Security"
        actions={
          <Link
            href="/dashboard/settings/profile"
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-2 hover:underline"
          >
            All settings
          </Link>
        }
      />
      <Suspense fallback={null}>
        <SecuritySettingsAlerts />
      </Suspense>
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
      <Surface variant="section" padding="md" className="space-y-6 scroll-mt-24">
        <div className="space-y-1">
          <h2 className="font-headline text-lg font-semibold text-on-surface">Sign-in methods</h2>
          <p className="font-body text-sm text-on-surface-variant">
            Manage how you sign in to LAX — password, linked accounts, and related security options.
          </p>
        </div>
        <SecurityAccountMethods emailVerified={me.emailVerified === true} />
      </Surface>
      {me.securityStatusAvailable === true ? (
        <TwoFactorStatusCard twoFactorEnabled={me.twoFactorEnabled === true} />
      ) : (
        <Alert>
          <AlertTitle>Two-factor status unavailable</AlertTitle>
          <AlertDescription>
            We could not load your current two-factor authentication status. Try again later before
            changing this setting.
          </AlertDescription>
        </Alert>
      )}
      {deletionRequestedAt ? null : (
        <Surface variant="section" padding="md" className="space-y-4 border-destructive/30">
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-semibold text-destructive">Danger zone</h2>
            <p className="font-body text-sm text-on-surface-variant">
              Irreversible after processing — see privacy policy.
            </p>
          </div>
          <DeleteAccountForm />
        </Surface>
      )}
    </DashboardPage>
  );
}
