import "server-only";

import { VIEWER_ZONE_COOKIE, type ViewerZone, resolveViewerZone } from "@auction/datetime";

/**
 * Where a person's "Always use" zone comes from. LAX Account will provide it; until then the
 * default port knows nothing, so the cookie decides.
 */
export interface AccountTimeZonePort {
  alwaysUseZone(): Promise<string | null>;
}

export const noAccountTimeZone: AccountTimeZonePort = {
  alwaysUseZone: async () => null,
};

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
