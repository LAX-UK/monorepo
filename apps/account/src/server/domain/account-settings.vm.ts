import type { AccountLinksVm, PayoutLaunchLinkVm, StaffPlatformLinkVm } from "./account-links";
import type { AccountOverviewVm } from "./account-overview.vm";
import type { AccountSecurityFacts } from "./account-security-facts";

export type SettingsRowVm = { title: string; subtitle?: string; href: string };

export type SettingsGroupVm = { id: string; label: string; footer?: string; rows: SettingsRowVm[] };

export const ACCOUNT_ROUTES = {
  overview: "/account",
  profile: "/account/profile",
  security: "/account/security",
  privacy: "/account/privacy",
  help: "/account/help",
} as const;

export type AccountSectionVm = {
  id: "personal-details" | "security" | "privacy" | "help";
  title: string;
  description: string;
  href: string;
};

/**
 * The overview's category cards. Help opens Bid's published help centre and contact pages, so
 * the card is left out when Bid is not configured.
 */
export function buildAccountSections(links: Pick<AccountLinksVm, "support">): AccountSectionVm[] {
  const sections: AccountSectionVm[] = [
    {
      id: "personal-details",
      title: "Personal details",
      description: "Name, email, phone and addresses",
      href: ACCOUNT_ROUTES.profile,
    },
    {
      id: "security",
      title: "Password and security",
      description: "Password and two-step verification",
      href: ACCOUNT_ROUTES.security,
    },
    {
      id: "privacy",
      title: "Notifications and privacy",
      description: "Notification preferences, your data and policies",
      href: ACCOUNT_ROUTES.privacy,
    },
  ];
  if (links.support) {
    sections.push({
      id: "help",
      title: "Help",
      description: "Help centre and how to contact us",
      href: ACCOUNT_ROUTES.help,
    });
  }
  return sections;
}

/** Password and security page. Both rows open the issuer's hosted pages, which own the change. */
export function buildSecurityGroups(
  facts: Pick<AccountSecurityFacts, "twoStepConfirmed">,
  links: Pick<AccountLinksVm, "changePassword" | "manageTwoStep">,
): SettingsGroupVm[] {
  return [
    {
      id: "sign-in",
      label: "Signing in",
      rows: [
        {
          title: "Password",
          subtitle: "We'll email you a secure link to change it",
          href: links.changePassword,
        },
        {
          title: "Two-step verification",
          subtitle: facts.twoStepConfirmed ? "On" : "Set up or manage",
          href: links.manageTwoStep,
        },
      ],
    },
  ];
}

/** Help page rows; empty without Bid, which publishes the help centre. */
export function buildHelpGroups(links: Pick<AccountLinksVm, "support">): SettingsGroupVm[] {
  if (!links.support) return [];
  return [
    {
      id: "support",
      label: "Support",
      rows: [
        { title: "Help centre", href: links.support.helpCentre },
        { title: "Contact us", href: links.support.contact },
      ],
    },
  ];
}

/**
 * Entry points to other LAX tools that belong to no category above: payout onboarding and the
 * admin tools a staff member can open.
 */
export function buildLaunchGroups(input: {
  payoutLinks: PayoutLaunchLinkVm[];
  staffPlatforms: StaffPlatformLinkVm[];
}): SettingsGroupVm[] {
  const groups: SettingsGroupVm[] = [
    {
      id: "payouts",
      label: "Payout accounts",
      footer: "Bank and tax details live on each LAX business product.",
      rows: input.payoutLinks.map((link) => ({ title: link.label, href: link.href })),
    },
    {
      id: "lax-access",
      label: "Your LAX access",
      footer: "Your role on each tool is managed by a LAX admin.",
      rows: input.staffPlatforms.map((platform) => ({
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
