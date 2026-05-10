import "server-only";

import {
  getActingLegalEntityHeader,
  getUserRoleIfImpersonationActingCookie,
} from "@/lib/legal-entity/acting-context.server";
import { cookies } from "next/headers";
import { getServerApiBase } from "./hc-server";

export type AuthedServerFetchInit = RequestInit & {
  /** Skip auto-attaching `X-Legal-Entity-Id` from the acting cookie (e.g. when
   * you pass an explicit header via {@link authedServerFetch} from
   * `authed-fetch.server` or entity-scoped server actions). */
  skipActingLegalEntityHeader?: boolean;
};

/** Cookie-authenticated `fetch` for Server Components and Server Actions.
 *
 * By default forwards `X-Legal-Entity-Id` from the acting-entity cookie so API
 * routes using strict `requireLegalEntityContext` (e.g. `/payouts`,
 * `/stripe-connect/*`, `/legal-entities/members`) receive a membership-valid
 * header. Dashboard pages that must target a specific entity should keep using
 * {@link import("./authed-fetch.server").authedServerFetch} with an explicit
 * header, or pass {@link AuthedServerFetchInit.skipActingLegalEntityHeader} here.
 *
 * When the acting cookie carries an admin impersonation session, resolves the
 * session role so impersonation validation matches platform administrators.
 */
export async function authedServerFetch(
  path: string,
  init?: AuthedServerFetchInit,
): Promise<Response> {
  const { skipActingLegalEntityHeader, ...fetchInit } = init ?? {};
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = new Headers(fetchInit.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (!skipActingLegalEntityHeader) {
    const userRole = await getUserRoleIfImpersonationActingCookie();
    const acting = await getActingLegalEntityHeader(userRole);
    for (const [k, v] of Object.entries(acting)) {
      if (!headers.has(k)) headers.set(k, v);
    }
  }
  return fetch(`${getServerApiBase()}${path}`, {
    ...fetchInit,
    headers,
    credentials: "include",
  });
}
