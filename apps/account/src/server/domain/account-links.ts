import type { LaxStaffPlatformsClaim } from "@auction/identity-contracts";
import type { LaxAccountConfig } from "../config";

/**
 * Settings that Bid's API still owns. LAX Account only reads products through the read-only
 * portfolio scope and never writes to them, so it links to Bid's screens instead of editing this
 * data itself. Name and sessions are not here: the issuer owns them and Account edits them
 * directly.
 */
export type BidSettingsLinksVm = {
  notifications: string;
};

/**
 * Account sign-in runs on lax.bid (auth.lax.bid, account.lax.bid), so Bid's published support
 * and policy pages are the ones that cover the LAX account.
 */
export type SupportLinksVm = {
  helpCentre: string;
  contact: string;
  terms: string;
  privacyPolicy: string;
};

export type AccountLinksVm = {
  manageTwoStep: string;
  changePassword: string;
  verifyEmail: string;
  bidSettings: BidSettingsLinksVm | null;
  support: SupportLinksVm | null;
};

export function buildAccountLinks(
  config: Pick<LaxAccountConfig, "oidcIssuer" | "oidcClientId" | "bidPublicUrl">,
  account: { email?: string | null } = {},
): AccountLinksVm {
  const hosted = (path: string, query: Record<string, string> = {}) => {
    const url = new URL(path, config.oidcIssuer);
    url.searchParams.set("client_id", config.oidcClientId);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return url.toString();
  };
  const bidUrl = config.bidPublicUrl;
  const bid = (path: string) => new URL(path, bidUrl).toString();
  return {
    manageTwoStep: hosted("/two-factor/manage"),
    changePassword: hosted("/forgot-password"),
    verifyEmail: hosted("/resend-verification", account.email ? { email: account.email } : {}),
    bidSettings: bidUrl
      ? {
          notifications: bid("/dashboard/settings/notifications"),
        }
      : null,
    support: bidUrl
      ? {
          helpCentre: bid("/faq"),
          contact: bid("/contact"),
          terms: bid("/terms"),
          privacyPolicy: bid("/privacy"),
        }
      : null,
  };
}

/** Bid lists the organisations a person belongs to and their role in each; null without Bid. */
export function buildOrganisationsLink(
  config: Pick<LaxAccountConfig, "bidPublicUrl">,
): string | null {
  return config.bidPublicUrl
    ? new URL("/dashboard/organisations", config.bidPublicUrl).toString()
    : null;
}

export type StaffPlatformLinkVm = { product: "bid" | "shop"; label: string; href: string };

export type PayoutLaunchLinkVm = { label: string; href: string };

/** Product-owned payout onboarding entry points (Account does not read balances or Connect state). */
export function buildPayoutLaunchLinks(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl">,
): PayoutLaunchLinkVm[] {
  const links: PayoutLaunchLinkVm[] = [];
  if (config.bidPublicUrl) {
    links.push({
      label: "LAX Bid payouts",
      href: new URL("/dashboard/seller/connect", config.bidPublicUrl).toString(),
    });
  }
  const artPayouts = config.laxArtPublicUrl ?? config.shopPublicUrl;
  if (artPayouts) {
    links.push({
      label: "LAX Art payouts",
      href: new URL("/account/payouts", artPayouts).toString(),
    });
  }
  return links;
}

/** Admin launch links for the platforms in the ID token; platforms without a configured URL are skipped. */
export function buildStaffPlatformLinks(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopAdminUrl">,
  platforms: LaxStaffPlatformsClaim,
): StaffPlatformLinkVm[] {
  const targets = {
    bid: {
      label: "LAX Bid admin",
      href: config.bidPublicUrl ? `${config.bidPublicUrl}/admin` : null,
    },
    shop: { label: "LAX Shop Admin", href: config.shopAdminUrl ?? null },
  };
  return platforms.flatMap((product) => {
    const { label, href } = targets[product];
    return href ? [{ product, label, href }] : [];
  });
}
