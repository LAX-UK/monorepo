import "server-only";

import {
  type AuthedServerFetchInit,
  authedServerFetch as authedServerFetchImpl,
} from "@/lib/data/http/authed-server-fetch";

/** Back-compat wrapper: cookie + Origin, without acting legal-entity header. */
export async function authedServerFetch(path: string, init?: RequestInit): Promise<Response> {
  return authedServerFetchImpl(path, {
    ...init,
    skipActingLegalEntityHeader: true,
  } satisfies AuthedServerFetchInit);
}
