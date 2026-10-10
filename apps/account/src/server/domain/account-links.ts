import type { LaxAccountConfig } from "../config";

export type AccountLinksVm = {
  setUpAuthenticator: string;
  changePassword: string;
  /** Bid owns profile edits until the portal gains its own editor. */
  editProfile: string | null;
};

export function buildAccountLinks(
  config: Pick<LaxAccountConfig, "oidcIssuer" | "oidcClientId" | "bidPublicUrl">,
): AccountLinksVm {
  const hosted = (path: string) => {
    const url = new URL(path, config.oidcIssuer);
    url.searchParams.set("client_id", config.oidcClientId);
    return url.toString();
  };
  return {
    setUpAuthenticator: hosted("/two-factor/setup"),
    changePassword: hosted("/forgot-password"),
    editProfile: config.bidPublicUrl
      ? new URL("/dashboard/settings/profile", config.bidPublicUrl).toString()
      : null,
  };
}
