import { isNewPerson, loadHomePortfolio } from "@/server/application/load-home-portfolio";
import type { SettingsGroupVm } from "@/server/domain/account-settings.vm";
import { CardLinkSection } from "./section-cards";

/** The launch links (payouts and staff tools) as card sections. */
export function LaunchGroups({ groups }: { groups: readonly SettingsGroupVm[] }) {
  return groups.map((group) => (
    <CardLinkSection
      key={group.id}
      id={group.id}
      heading={group.label}
      items={group.rows.map(({ title, subtitle, href }) => ({
        key: href,
        title,
        href,
        ...(subtitle ? { description: subtitle } : {}),
      }))}
      {...(group.footer ? { footer: group.footer } : {})}
    />
  ));
}

/**
 * The launch links, hidden for someone who has no works yet: their first screen is about
 * starting a collection, not about payouts they do not need.
 */
export async function HomeLaunchGroups({ groups }: { groups: readonly SettingsGroupVm[] }) {
  const loaded = await loadHomePortfolio();
  return isNewPerson(loaded) ? null : <LaunchGroups groups={groups} />;
}
