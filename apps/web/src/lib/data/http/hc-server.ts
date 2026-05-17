import "server-only";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/analytics/consent/cookie";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";
import { buildAuthedSsrHeaders } from "@/lib/data/http/server-request-headers";
import { cookies } from "next/headers";

/** When INTERNAL_API_URL uses 127.0.0.1 but NEXT_PUBLIC_API_URL uses localhost (or vice versa),
 * SSR requests would hit a different HTTP Host than `API_PUBLIC_URL` on the API. Better Auth
 * validates session cookies against `baseURL` host; a mismatch can yield flaky 401/empty session.
 * Normalize loopback pairs to the **public** hostname while keeping port/protocol from INTERNAL. */
function alignLoopbackHostnameWithPublicApi(
  internal: string,
  publicUrl: string | undefined,
): string {
  if (!publicUrl) return internal;
  try {
    const i = new URL(internal);
    const p = new URL(publicUrl);
    const onlyLoopbackNameMismatch =
      i.port === p.port &&
      i.protocol === p.protocol &&
      ((i.hostname === "127.0.0.1" && p.hostname === "localhost") ||
        (i.hostname === "localhost" && p.hostname === "127.0.0.1"));
    if (onlyLoopbackNameMismatch) {
      i.hostname = p.hostname;
      return i.origin;
    }
  } catch {
    /* fall through */
  }
  return internal;
}

/** Base URL for server-side API calls (SSR / route handlers).
 *
 * Prefer INTERNAL_API_URL for hairpin-NAT / private-network builds; otherwise fall back to
 * NEXT_PUBLIC_API_URL, then localhost.
 */
export function getServerApiBase(): string {
  const pub = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  const internalRaw = process.env.INTERNAL_API_URL?.replace(/\/$/, "");
  if (internalRaw) {
    return alignLoopbackHostnameWithPublicApi(internalRaw, pub);
  }
  if (pub) return pub;
  return "http://127.0.0.1:3001";
}

export async function getServerHc(): Promise<RpcApp> {
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
      const headers = await buildAuthedSsrHeaders(headerOpts);
      return fetch(input, {
        ...init,
        cache: init?.cache ?? "no-store",
        headers,
        credentials: "include",
      });
    },
  });
}
