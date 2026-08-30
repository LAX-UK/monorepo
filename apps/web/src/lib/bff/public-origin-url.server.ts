import "server-only";

import { bffConfig } from "./config.server";

/**
 * Builds a URL on the configured public site origin (NEXT_PUBLIC_SITE_URL).
 * Use for post-auth redirects instead of `request.url`, which may carry a bind
 * address such as `0.0.0.0` in standalone/CI and break cookie scope in browsers.
 */
export function resolvePublicOriginUrl(path: string): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${bffConfig().publicOrigin}/`);
}

export { isLoopbackHostname } from "./loopback-host";
