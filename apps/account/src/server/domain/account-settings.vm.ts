import type { AccountLinksVm, PayoutLaunchLinkVm, StaffPlatformLinkVm } from "./account-links";
import type { AccountOverviewVm } from "./account-overview.vm";

export type SettingsRowVm = { title: string; subtitle?: string; href: string };

export type SettingsGroupVm = { id: string; label: string; footer?: string; rows: SettingsRowVm[] };

export const ACCOUNT_ROUTES = {
  settings: "/account",
  profile: "/account/profile",
  privacy: "/account/privacy",
} as const;

/**
 * Settings screen (Figma 930:14289). Rows only point at destinations that exist:
 * Language and Appearance are left out because Account has no locale support and
 * no theme preference shared across LAX origins; "Collect Hub" is a lax.art screen.
 */
export function buildSettingsGroups(input: {
  overview: Pick<AccountOverviewVm, "signedInWithAuthenticator">;
  links: AccountLinksVm;
  payoutLinks: PayoutLaunchLinkVm[];
  staffPlatforms: StaffPlatformLinkVm[];
}): SettingsGroupVm[] {
  const { overview, links, payoutLinks, staffPlatforms } = input;
  const groups: SettingsGroupVm[] = [
    {
      id: "account",
      label: "Account",
      rows: [
        {
          title: "Edit account",
          subtitle: "Name, email, phone and addresses",
          href: ACCOUNT_ROUTES.profile,
        },
        {
          title: "Password",
          subtitle: "We'll email you a secure link to change it",
          href: links.changePassword,
        },
        {
          title: "Two-step verification",
          subtitle: overview.signedInWithAuthenticator ? "On for this sign-in" : "Set up or manage",
          href: links.manageTwoStep,
        },
      ],
    },
    {
      id: "preferences",
      label: "Preferences",
      rows: links.bidSettings
        ? [
            {
              title: "Notification preferences",
              subtitle: "Managed in LAX Bid",
              href: links.bidSettings.notifications,
            },
          ]
        : [],
    },
    {
      id: "support",
      label: "Support",
      rows: links.support
        ? [
            { title: "Help centre", href: links.support.helpCentre },
            { title: "Contact us", href: links.support.contact },
          ]
        : [],
    },
    {
      id: "legal",
      label: "Legal",
      // The privacy centre only lists Bid-hosted destinations, so it shares their condition.
      rows: links.support
        ? [
            { title: "Terms & conditions", href: links.support.terms },
            { title: "Privacy centre", href: ACCOUNT_ROUTES.privacy },
          ]
        : [],
    },
    {
      id: "payouts",
      label: "Payout accounts",
      footer: "Bank and tax details live on each LAX business product.",
      rows: payoutLinks.map((link) => ({ title: link.label, href: link.href })),
    },
    {
      id: "lax-access",
      label: "Your LAX access",
      footer: "Your role on each tool is managed by a LAX admin.",
      rows: staffPlatforms.map((platform) => ({
        title: platform.label,
        subtitle: "Staff access",
        href: platform.href,
      })),
    },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

/** Avatar initials: first and last name initials, else the email's first letter, else none. */
export function accountInitials(
  overview: Pick<AccountOverviewVm, "name" | "email">,
): string | null {
  const words = overview.name?.split(/\s+/).filter(Boolean) ?? [];
  const first = words[0]?.[0];
  if (first) {
    const last = words.length > 1 ? words[words.length - 1]?.[0] : "";
    return `${first}${last ?? ""}`.toUpperCase();
  }
  return overview.email?.[0]?.toUpperCase() ?? null;
}
