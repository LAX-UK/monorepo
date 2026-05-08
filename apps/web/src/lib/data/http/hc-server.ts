import "server-only";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";
import { cookies } from "next/headers";

/** Base URL for Server Components / Route Handlers calling the API.
 * Prefer INTERNAL_API_URL on the host (e.g. http://127.0.0.1:3001) so SSR does not rely on
 * NEXT_PUBLIC_API_URL (often the public IP), which can fail with hairpin NAT or wrong host.
 */
/** Base URL for server-side API calls (SSR / route handlers). */
export function getServerApiBase(): string {
  const internal = process.env.INTERNAL_API_URL?.replace(/\/$/, "");
  if (internal) return internal;
  const pub = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (pub) return pub;
  return "http://127.0.0.1:3001";
}

export async function getServerHc(): Promise<RpcApp> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return hcAsRpcApp(getServerApiBase(), {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (cookieHeader) headers.set("Cookie", cookieHeader);
      return fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });
    },
  });
}
