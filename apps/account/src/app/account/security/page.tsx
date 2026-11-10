import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { BackupCodesSection } from "@/components/backup-codes-section";
import { DeleteAccountLink } from "@/components/delete-account-link";
import { PasswordPanel } from "@/components/password-section";
import { SignInMethodsSection } from "@/components/sign-in-methods-section";
import { SignedInDevicesSection } from "@/components/signed-in-devices-section";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildBackupCodesSection } from "@/server/domain/account-backup-codes.vm";
import { buildDevicesSection } from "@/server/domain/account-devices-section.vm";
import { buildAccountLinks } from "@/server/domain/account-links";
import { passwordFormMode } from "@/server/domain/account-password.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { readAccountSecurityFacts } from "@/server/domain/account-security-facts";
import { ACCOUNT_ROUTES, buildTwoStepRow } from "@/server/domain/account-settings.vm";
import {
  buildSignInMethodFlash,
  buildSignInMethodsSection,
  signInMethodFacts,
} from "@/server/domain/account-sign-in-methods.vm";
import {
  ACCOUNT_SIGN_IN_METHOD_PROVIDER_PARAM,
  ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM,
} from "@auction/identity-contracts/account";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Password and security · LAX Account" };

type SecurityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const params = await searchParams;
  const returned = params[ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM];
  const returnedProvider = params[ACCOUNT_SIGN_IN_METHOD_PROVIDER_PARAM];
  const session = await loadAccountSession({
    withLiveSecurity: true,
    withLiveSessions: true,
    withLiveSignInMethods: true,
  });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.security} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.security}`);
  const { overview, liveSecurity, liveSessions, liveSignInMethods } = session;
  const links = buildAccountLinks(getLaxAccountContainer().config, { email: overview.email });
  const facts = readAccountSecurityFacts(overview, liveSecurity);
  const backupCodes = buildBackupCodesSection(facts);

  return (
    <AccountShell>
      <AccountPageHeader
        title="Security"
        description="Your sign-in methods, password, two-step verification and devices."
      />
      <SignInMethodsSection
        section={buildSignInMethodsSection(liveSignInMethods)}
        flash={buildSignInMethodFlash(
          returned,
          returnedProvider,
          signInMethodFacts(liveSignInMethods),
        )}
        pagePath={ACCOUNT_ROUTES.security}
        reauthHref={buildReauthHref(ACCOUNT_ROUTES.security)}
        passwordPanel={
          <PasswordPanel
            mode={passwordFormMode(facts)}
            forgotPasswordHref={links.forgotPassword}
            pagePath={ACCOUNT_ROUTES.security}
          />
        }
        twoStep={buildTwoStepRow(facts, links)}
      />
      {backupCodes ? (
        <BackupCodesSection section={backupCodes} pagePath={ACCOUNT_ROUTES.security} />
      ) : null}
      <SignedInDevicesSection
        section={buildDevicesSection(liveSessions, new Date())}
        pagePath={ACCOUNT_ROUTES.security}
        reauthHref={buildReauthHref(ACCOUNT_ROUTES.security)}
      />
      <DeleteAccountLink />
    </AccountShell>
  );
}
