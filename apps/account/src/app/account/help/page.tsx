import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { ACCOUNT_ROUTES, buildHelpGroups } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Help · LAX Account" };

export default async function HelpPage() {
  const session = await loadAccountSession();
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.help} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.help}`);
  const groups = buildHelpGroups(buildAccountLinks(getLaxAccountContainer().config));
  if (groups.length === 0) notFound();

  return (
    <AccountShell>
      <AccountPageHeader
        title="Help"
        description="Find answers in the help centre, or get in touch with us."
      />
      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}
    </AccountShell>
  );
}
