import type { AccountLinksVm } from "./account-links";
import { ACCOUNT_ROUTES, type SettingsGroupVm } from "./account-settings.vm";

/**
 * Notifications and privacy (Figma 956:14309). The data-sharing switch is left out: no LAX
 * service stores an account-level data-sharing choice yet. Notification preferences run in
 * LAX Bid, which owns them; deleting the account is an Account page, whatever else is configured.
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
  }
  groups.push({
    id: "your-data",
    label: "Your data",
    footer:
      "Deleting your account permanently removes it and your personal data, in line with applicable law. We check LAX Bid, LAX Shop and lax.art first, and you can cancel for 30 days.",
    rows: [{ title: "Delete your account", href: ACCOUNT_ROUTES.deleteAccount }],
  });
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
