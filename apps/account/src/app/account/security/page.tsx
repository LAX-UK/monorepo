import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { BackupCodesSection } from "@/components/backup-codes-section";
import { SignedInDevicesSection } from "@/components/signed-in-devices-section";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildBackupCodesSection } from "@/server/domain/account-backup-codes.vm";
import { buildDevicesSection } from "@/server/domain/account-devices-section.vm";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { readAccountSecurityFacts } from "@/server/domain/account-security-facts";
import { ACCOUNT_ROUTES, buildSecurityGroups } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Password and security · LAX Account" };

export default async function SecurityPage() {
  const session = await loadAccountSession({ withLiveSecurity: true, withLiveSessions: true });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.security} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.security}`);
  const { overview, liveSecurity, liveSessions } = session;
  const links = buildAccountLinks(getLaxAccountContainer().config, { email: overview.email });
  const facts = readAccountSecurityFacts(overview, liveSecurity);
  const groups = buildSecurityGroups(facts, links);
  const backupCodes = buildBackupCodesSection(facts);

  return (
    <AccountShell>
      <AccountPageHeader title="Password and security" backHref={ACCOUNT_ROUTES.overview} />
      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}
      {backupCodes ? (
        <BackupCodesSection section={backupCodes} pagePath={ACCOUNT_ROUTES.security} />
      ) : null}
      <SignedInDevicesSection
        section={buildDevicesSection(liveSessions, new Date())}
        pagePath={ACCOUNT_ROUTES.security}
        reauthHref={buildReauthHref(ACCOUNT_ROUTES.security)}
      />
    </AccountShell>
  );
}
