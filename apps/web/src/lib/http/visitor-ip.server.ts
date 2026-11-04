import "server-only";

import { serverClientIpHeaders } from "@auction/http-headers/client-ip";
import { headers } from "next/headers";
import { resolveVisitorIp } from "./visitor-ip";

/** The current request's visitor address; "unknown" when it cannot be told. */
export async function currentVisitorIp(): Promise<string> {
  return resolveVisitorIp(await headers());
}

/** The visitor's address for the Bid API, sent with the shared token so the API believes it. */
export function visitorIpHeadersFor(visitorIp: string): Record<string, string> {
  return serverClientIpHeaders(visitorIp, process.env.API_SSR_CLIENT_IP_TOKEN);
}

export async function currentVisitorIpHeaders(): Promise<Record<string, string>> {
  return visitorIpHeadersFor(await currentVisitorIp());
}
