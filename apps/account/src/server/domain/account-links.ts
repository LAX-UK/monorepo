import type { LaxAccountConfig } from "../config";

export type AccountLinksVm = {
  setUpAuthenticator: string;
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
    setUpAuthenticator: hosted("/two-factor/setup"),
    changePassword: hosted("/forgot-password"),
    verifyEmail: hosted("/resend-verification", account.email ? { email: account.email } : {}),
    editProfile: config.bidPublicUrl
      ? new URL("/dashboard/settings/profile", config.bidPublicUrl).toString()
      : null,
  };
}
