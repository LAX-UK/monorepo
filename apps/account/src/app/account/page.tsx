import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, SettingsGroup } from "@/components/account-ui";
import { CompleteAccountBanner } from "@/components/complete-account-banner.client";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import {
  buildAccountLinks,
  buildPayoutLaunchLinks,
  buildStaffPlatformLinks,
} from "@/server/domain/account-links";
import {
  ACCOUNT_ROUTES,
  accountInitials,
  buildSettingsGroups,
} from "@/server/domain/account-settings.vm";
import { profileGaps } from "@/server/domain/profile-completeness";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import { Button } from "@auction/ui/components/button";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Account settings (Figma 930:14289; with the completion prompt, 930:15435). */
export default async function AccountSettingsPage() {
  const session = await loadAccountSession();
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.settings}`);
  const { overview } = session;
  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config, { email: overview.email });
  const groups = buildSettingsGroups({
    overview,
    links,
    payoutLinks: buildPayoutLaunchLinks(config),
    staffPlatforms: buildStaffPlatformLinks(config, overview.staffPlatforms),
  });
  const gaps = profileGaps(overview, { profileEditable: links.bidSettings !== null });
  const initials = accountInitials(overview);

  return (
    <AccountShell>
      <AccountPageHeader title="Account settings" />

      <div className="flex flex-col items-center gap-3 text-center">
        {initials ? (
          <Avatar className="size-14 rounded-none border border-dashed border-outline-variant">
            <AvatarFallback className="rounded-none bg-surface font-headline text-lg font-semibold text-on-surface">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="font-headline text-base font-semibold text-on-surface">
            {overview.displayName}
          </p>
          <p className="max-w-md text-sm text-on-surface-variant">
            These details are shared by LAX Bid, LAX Art and every product you sign in to with this
            account.
          </p>
        </div>
      </div>

      {gaps.length > 0 ? (
        <CompleteAccountBanner gapsKey={gaps.join(",")} href={ACCOUNT_ROUTES.profile} />
      ) : null}

      {groups.map((group) => (
        <SettingsGroup key={group.id} group={group} />
      ))}

      <form method="post" action="/api/auth/logout">
        <Button type="submit" variant="outline" size="lg" className="w-full border-border-hairline">
          Sign out
        </Button>
      </form>
    </AccountShell>
  );
}
