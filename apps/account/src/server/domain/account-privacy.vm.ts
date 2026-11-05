import { legalOperatorSentence } from "@auction/branding";
import type { AccountLinksVm } from "./account-links";
import { ACCOUNT_ROUTES, type SettingsGroupVm } from "./account-settings.vm";
import { DATA_EXPORT_ROUTE } from "./data-export-routes";
import { DEFAULT_DATA_EXPORT_SUBTITLE } from "./data-export.vm";

/**
 * Notifications and privacy (Figma 956:14309). The data-sharing switch is left out: no LAX
 * service stores an account-level data-sharing choice yet. Alert emails from every product are
 * one Account page; deleting the account is an Account page, whatever else is configured.
 */
export function buildPrivacyGroups(
  links: Pick<AccountLinksVm, "support">,
  /** Where the person's data download stands, as a line (see buildDataExportRowSubtitle). */
  dataExportSubtitle: string = DEFAULT_DATA_EXPORT_SUBTITLE,
): SettingsGroupVm[] {
  const groups: SettingsGroupVm[] = [
    {
      id: "notifications",
      label: "Notifications",
      rows: [
        {
          title: "Email alerts",
          subtitle: "Alerts from LAX Bid, LAX Shop and lax.art",
          href: ACCOUNT_ROUTES.alerts,
        },
      ],
    },
  ];
  groups.push({
    id: "your-data",
    label: "Your data",
    footer:
      "Deleting your account permanently removes it and your personal data, in line with applicable law. We check LAX Bid, LAX Shop and lax.art first, and you can cancel for 30 days.",
    rows: [
      { title: "Download your data", subtitle: dataExportSubtitle, href: DATA_EXPORT_ROUTE },
      { title: "Delete your account", href: ACCOUNT_ROUTES.deleteAccount },
    ],
  });
  if (links.support) {
    groups.push({
      id: "policies",
      label: "Policies",
      footer: legalOperatorSentence("account"),
      rows: [
        { title: "Privacy policy", href: links.support.privacyPolicy },
        { title: "Terms of use", href: links.support.terms },
      ],
    });
  }
  return groups;
}
