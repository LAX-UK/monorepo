import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { AutoClearQueryParams } from "@/components/dashboard/auto-clear-query-params";
import { SettingsConnectedAccounts } from "@/components/dashboard/settings-connected-accounts";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

export type SettingsSecurityTabProps = {
  user: {
    email: string;
    emailStatus?: string;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
  };
  hasPendingEmailChange: boolean;
  deletionRequestedAt: Date | null;
  emailChanged?: boolean;
  /** Set to "google" or "apple" after a successful link redirect; renders a one-shot banner. */
  linkedProvider?: "google" | "apple" | null;
  /** True when /auth/setup-password just succeeded; renders a one-shot banner. */
  passwordJustSet?: boolean;
};

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

/** Account security tab: mirrors `/dashboard/settings/security` + email / org blocks from account page. */
export function SettingsSecurityTabContent({
  user,
  hasPendingEmailChange,
  deletionRequestedAt,
  emailChanged,
  linkedProvider,
  passwordJustSet,
}: SettingsSecurityTabProps) {
  const showLinkBanner = linkedProvider === "google" || linkedProvider === "apple";
  const showPasswordBanner = passwordJustSet === true;
  return (
    <div className="space-y-10 pt-2">
      {showLinkBanner || showPasswordBanner || emailChanged ? (
        <AutoClearQueryParams params={["linked", "password", "changed"]} />
      ) : null}

      {emailChanged ? (
        <Alert>
          <AlertTitle>Confirmation sent</AlertTitle>
          <AlertDescription>Check your inbox to confirm the email change.</AlertDescription>
        </Alert>
      ) : null}

      {showLinkBanner ? (
        <Alert>
          <AlertTitle>{linkedProvider === "google" ? "Google" : "Apple"} connected</AlertTitle>
          <AlertDescription>
            You can now sign in with {linkedProvider === "google" ? "Google" : "Apple"} using this
            account.
          </AlertDescription>
        </Alert>
      ) : null}

      {showPasswordBanner ? (
        <Alert>
          <AlertTitle>Password set</AlertTitle>
          <AlertDescription>
            You can now sign in with your email and password as well as your other connected
            methods.
          </AlertDescription>
        </Alert>
      ) : null}

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

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
        <SettingsSection title="Sign-in email" titleAs="h3" eyebrow bordered={false}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-body text-base text-on-surface">{user.email}</p>
            <StatusBadge variant={statusVariant(user.emailStatus, user.emailVerified)}>
              {statusLabel(user.emailStatus, user.emailVerified)}
            </StatusBadge>
          </div>
        </SettingsSection>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
        <SettingsSection title="Change email" titleAs="h3" eyebrow bordered={false}>
          <p className="font-body text-sm text-on-surface-variant">
            We send confirmation links to your current address and the new address — both must
            confirm before the switch.
          </p>
          <div className="mt-4">
            <ChangeEmailForm
              currentEmail={user.email}
              hasPendingEmailChange={hasPendingEmailChange}
            />
          </div>
        </SettingsSection>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
        <SettingsSection title="Password" titleAs="h3" eyebrow bordered={false}>
          <SecurityPasswordForm />
        </SettingsSection>
      </div>

      <SettingsConnectedAccounts userEmail={user.email} />

      <TwoFactorStatusCard twoFactorEnabled={user.twoFactorEnabled === true} />

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
        <SettingsSection title="Organisations" titleAs="h3" eyebrow bordered={false}>
          <p className="font-body text-sm text-on-surface-variant">
            Invites, membership, and onboarding for galleries, dealers, and estates.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild variant="cta" size="sm">
              <Link href="/dashboard/organisations">Open Organisations</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding/organisation?fresh=1">Register organisation</Link>
            </Button>
          </div>
        </SettingsSection>
      </div>

      {deletionRequestedAt ? null : (
        <Card className="rounded-xl border border-destructive/30 shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>Irreversible after processing — see privacy policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
