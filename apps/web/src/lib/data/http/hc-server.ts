import "server-only";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/analytics/consent/cookie";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";
import {
  NO_STORE_FETCH_POLICY,
  type ServerFetchPolicy,
  mergeFetchInitWithPolicy,
} from "@/lib/data/http/server-fetch-policy";
import { buildAuthedSsrHeaders } from "@/lib/data/http/server-request-headers";
import { isReplayableBody, sendWithSsrKeyRetry } from "@/lib/data/http/ssr-key-retry.server";
import { cookies } from "next/headers";

import { getServerApiBase } from "@/lib/data/http/server-api-base";

export { getServerApiBase };

export async function createServerHc(
  policy: ServerFetchPolicy = NO_STORE_FETCH_POLICY,
): Promise<RpcApp> {
  const jar = await cookies();
  const consentRaw = jar.get(CONSENT_COOKIE_NAME)?.value;
  const consentSnapshot = consentRaw ? parseConsentCookie(consentRaw) : null;

  return hcAsRpcApp(getServerApiBase(), {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headerOpts: Parameters<typeof buildAuthedSsrHeaders>[0] = {
        skipActingLegalEntityHeader: true,
        consent: consentSnapshot,
      };
      if (init?.headers !== undefined) {
        headerOpts.init = init.headers;
      }
      return sendWithSsrKeyRetry({
        buildHeaders: (rejected) =>
          buildAuthedSsrHeaders(
            rejected === undefined ? headerOpts : { ...headerOpts, rejectedBearer: rejected },
          ),
        send: (headers) =>
          fetch(input, {
            ...mergeFetchInitWithPolicy(policy, init),
            headers,
            credentials: "include",
          }),
        replayable: isReplayableBody(init?.body),
      });
    },
  });
}

/** Default server Hono client — always dynamic (`no-store`). */
export async function getServerHc(): Promise<RpcApp> {
  return createServerHc(NO_STORE_FETCH_POLICY);
}
