import { ChangeEmailForm } from "@/components/auth/change-email-form";
import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { TwoFactorStatusCard } from "@/components/auth/two-factor-status-card";
import { AutoClearQueryParams } from "@/components/dashboard/auto-clear-query-params";
import { SettingsConnectedAccounts } from "@/components/dashboard/settings-connected-accounts";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { ReduceMotionCard } from "@/components/settings/reduce-motion-card";
import type { LegalEntityStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
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
  organisations: Array<{ id: string; displayName: string; status: LegalEntityStatus }>;
  emailChanged?: boolean;
  /** Set to "google" or "apple" after a successful link redirect; renders a one-shot banner. */
  linkedProvider?: "google" | "apple" | null;
  /** True when /auth/setup-password just succeeded; renders a one-shot banner. */
  passwordJustSet?: boolean;
};

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

/** Account security tab: mirrors `/dashboard/settings/security` + email / org blocks from account page. */
export function SettingsSecurityTabContent({
  user,
  hasPendingEmailChange,
  deletionRequestedAt,
  organisations,
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

      <ReduceMotionCard />

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
            Galleries, dealers, and estates you belong to.
          </p>
          {organisations.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">
              You don&apos;t belong to any organisations yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
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
            className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Add a gallery, dealer, or estate
          </Link>
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
