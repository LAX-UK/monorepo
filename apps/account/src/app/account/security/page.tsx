import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { readAccountSecurityFacts } from "@/server/domain/account-security-facts";
import { ACCOUNT_ROUTES, buildSecurityGroups } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Password and security · LAX Account" };

export default async function SecurityPage() {
  const session = await loadAccountSession({ withLiveSecurity: true });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.security} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.security}`);
  const { overview, liveSecurity } = session;
  const links = buildAccountLinks(getLaxAccountContainer().config, { email: overview.email });
  const groups = buildSecurityGroups(readAccountSecurityFacts(overview, liveSecurity), links);

  return (
    <AccountShell>
      <AccountPageHeader title="Password and security" backHref={ACCOUNT_ROUTES.overview} />
      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}
    </AccountShell>
  );
}
