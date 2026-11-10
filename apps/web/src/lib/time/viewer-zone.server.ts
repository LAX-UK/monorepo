import "server-only";

import { VIEWER_ZONE_COOKIE, type ViewerZone, resolveViewerZone } from "@auction/datetime";

/**
 * Where a person's "Always use" zone comes from: the city they fixed in LAX Account. Signed out,
 * or following their device, the port knows nothing, so the cookie (the device's own reading)
 * decides.
 */
export interface AccountTimeZonePort {
  alwaysUseZone(): Promise<string | null>;
}

export const noAccountTimeZone: AccountTimeZonePort = {
  alwaysUseZone: async () => null,
};

/** The signed-in person's LAX Account choice; only "Always use" overrides what the device says. */
export function accountTimeZoneFor(
  timeZone: { mode: "automatic" | "fixed"; zone: string | null } | undefined,
): AccountTimeZonePort {
  return {
    alwaysUseZone: async () => (timeZone?.mode === "fixed" ? timeZone.zone : null),
  };
}

type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * The zone to show this request's visitor their own time in: LAX Account "Always use", then the
 * `lax_tz` cookie, then unknown. UTC, `Etc/*` and invalid names count as unknown.
 */
export async function loadViewerZone(
  cookies: CookieReader,
  account: AccountTimeZonePort = noAccountTimeZone,
): Promise<ViewerZone> {
  return resolveViewerZone({
    account: await account.alwaysUseZone(),
    cookie: cookies.get(VIEWER_ZONE_COOKIE)?.value,
  });
}
