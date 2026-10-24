import type { AccountLinksVm, PayoutLaunchLinkVm, StaffPlatformLinkVm } from "./account-links";
import type { AccountOverviewVm } from "./account-overview.vm";
import { type AccountSecurityFacts, LOW_BACKUP_CODES_THRESHOLD } from "./account-security-facts";

export type SettingsRowVm = { title: string; subtitle?: string; href: string };

export type SettingsGroupVm = { id: string; label: string; footer?: string; rows: SettingsRowVm[] };

export const ACCOUNT_ROUTES = {
  overview: "/account",
  profile: "/account/profile",
  security: "/account/security",
  deleteAccount: "/account/security/delete",
  privacy: "/account/privacy",
  help: "/account/help",
} as const;

function twoStepSubtitle(
  facts: Pick<AccountSecurityFacts, "twoStep" | "backupCodesRemaining">,
): string {
  if (facts.twoStep === "unknown") return "Set up or manage";
  if (facts.twoStep === "off") return "Off. Turn it on";
  if (
    facts.backupCodesRemaining !== null &&
    facts.backupCodesRemaining <= LOW_BACKUP_CODES_THRESHOLD
  ) {
    return `On. ${facts.backupCodesRemaining} backup ${facts.backupCodesRemaining === 1 ? "code" : "codes"} left`;
  }
  return "On";
}

/**
 * Password and security page. The sign-in rows open the issuer's hosted pages, which own the
 * change; deleting the account is an Account page that asks every product first.
 */
export function buildSecurityGroups(
  facts: Pick<AccountSecurityFacts, "twoStep" | "backupCodesRemaining">,
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
          subtitle: twoStepSubtitle(facts),
          href: links.manageTwoStep,
        },
      ],
    },
    {
      id: "your-account",
      label: "Your account",
      rows: [
        {
          title: "Delete your account",
          subtitle: "Permanently delete your LAX account",
          href: ACCOUNT_ROUTES.deleteAccount,
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
