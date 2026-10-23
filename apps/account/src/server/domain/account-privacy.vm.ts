import type { AccountLinksVm } from "./account-links";
import type { SettingsGroupVm } from "./account-settings.vm";

/**
 * Notifications and privacy (Figma 956:14309). The data-sharing switch is left out: no LAX
 * service stores an account-level data-sharing choice yet. Notification preferences and
 * deletion run in LAX Bid, which owns them and the deletion step-up confirmation.
 */
export function buildPrivacyGroups(
  links: Pick<AccountLinksVm, "bidSettings" | "support">,
): SettingsGroupVm[] {
  const groups: SettingsGroupVm[] = [];
  if (links.bidSettings) {
    groups.push({
      id: "notifications",
      label: "Notifications",
      rows: [
        {
          title: "Notification preferences",
          subtitle: "Managed in LAX Bid",
          href: links.bidSettings.notifications,
        },
      ],
    });
    groups.push({
      id: "your-data",
      label: "Your data",
      footer:
        "Deleting your account permanently removes it and your data, in line with applicable law. You'll confirm in LAX Bid.",
      rows: [{ title: "Delete your account", href: links.bidSettings.deleteAccount }],
    });
  }
  if (links.support) {
    groups.push({
      id: "policies",
      label: "Policies",
      rows: [
        { title: "Privacy policy", href: links.support.privacyPolicy },
        { title: "Terms of use", href: links.support.terms },
      ],
    });
  }
  return groups;
}
