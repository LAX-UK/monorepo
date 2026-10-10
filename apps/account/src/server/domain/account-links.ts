import type { LaxStaffPlatformsClaim } from "@auction/identity-contracts";
import type { LaxAccountConfig } from "../config";

export type AccountLinksVm = {
  manageTwoStep: string;
  changePassword: string;
  verifyEmail: string;
  /** Bid owns profile edits until the portal gains its own editor. */
  editProfile: string | null;
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
  return {
    manageTwoStep: hosted("/two-factor/manage"),
    changePassword: hosted("/forgot-password"),
    verifyEmail: hosted("/resend-verification", account.email ? { email: account.email } : {}),
    editProfile: config.bidPublicUrl
      ? new URL("/dashboard/settings/profile", config.bidPublicUrl).toString()
      : null,
  };
}

export type StaffPlatformLinkVm = { product: "bid" | "shop"; label: string; href: string };

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
