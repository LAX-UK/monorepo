import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildPrivacyGroups } from "@/server/domain/account-privacy.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Notifications and privacy · LAX Account" };

/** Notifications and privacy (Figma 956:14309). */
export default async function PrivacyPage() {
  const session = await loadAccountSession();
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.privacy} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.privacy}`);
  const groups = buildPrivacyGroups(buildAccountLinks(getLaxAccountContainer().config));
  if (groups.length === 0) notFound();

  return (
    <AccountShell>
      <AccountPageHeader
        title="Privacy"
        description="Notification preferences, your data and the policies that cover your account."
      />
      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}
    </AccountShell>
  );
}
