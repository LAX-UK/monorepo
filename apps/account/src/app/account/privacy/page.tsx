import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { loadAccountSession } from "@/server/application/load-account-session";
import { loadDataExport } from "@/server/application/load-data-export";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildPrivacyGroups } from "@/server/domain/account-privacy.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import {
  DEFAULT_DATA_EXPORT_SUBTITLE,
  buildDataExportRowSubtitle,
} from "@/server/domain/data-export.vm";
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
  // The row's line follows the request; when Identity cannot say, it stays the neutral one.
  const read = await loadDataExport();
  const subtitle =
    read.status === "ok"
      ? buildDataExportRowSubtitle(read.view, new Date())
      : DEFAULT_DATA_EXPORT_SUBTITLE;
  const groups = buildPrivacyGroups(buildAccountLinks(getLaxAccountContainer().config), subtitle);
  if (groups.length === 0) notFound();

  return (
    <AccountShell>
      <AccountPageHeader
        title="Privacy"
        description="Email alerts, your data and the policies that cover your account."
      />
      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}
    </AccountShell>
  );
}
