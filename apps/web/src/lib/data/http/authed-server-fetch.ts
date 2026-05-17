import "server-only";

import { buildAuthedSsrHeaders } from "@/lib/data/http/server-request-headers";
import { getServerApiBase } from "./hc-server";

export type AuthedServerFetchInit = RequestInit & {
  /** Skip auto-attaching `X-Legal-Entity-Id` from the acting cookie (e.g. when
   * you pass an explicit header via {@link authedServerFetch} from
   * `authed-fetch.server` or entity-scoped server actions). */
  skipActingLegalEntityHeader?: boolean;
};

/** Cookie-authenticated `fetch` for Server Components and Server Actions.
 *
 * Forwards session cookies, SSR `Origin` (for API verify-origin), and by default
 * `X-Legal-Entity-Id` from the acting-entity cookie.
 */
export async function authedServerFetch(
  path: string,
  init?: AuthedServerFetchInit,
): Promise<Response> {
  const { skipActingLegalEntityHeader, ...fetchInit } = init ?? {};
  const headerOpts: Parameters<typeof buildAuthedSsrHeaders>[0] = {};
  if (skipActingLegalEntityHeader !== undefined) {
    headerOpts.skipActingLegalEntityHeader = skipActingLegalEntityHeader;
  }
  if (fetchInit.headers !== undefined) {
    headerOpts.init = fetchInit.headers;
  }
  const headers = await buildAuthedSsrHeaders(headerOpts);
  return fetch(`${getServerApiBase()}${path}`, {
    ...fetchInit,
    cache: fetchInit.cache ?? "no-store",
    headers,
    credentials: "include",
  });
}
