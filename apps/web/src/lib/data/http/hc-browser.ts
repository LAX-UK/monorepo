import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

let browserClient: RpcApp | null = null;

/** Typed Hono RPC client with cookies sent on same-site API calls. */
export function getBrowserHc(): RpcApp {
  if (!browserClient) {
    browserClient = hcAsRpcApp(base, {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
          ...init,
          credentials: "include",
        }),
    });
  }
  return browserClient;
}
