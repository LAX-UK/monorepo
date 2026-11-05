import "server-only";

import { headers } from "next/headers";
import { currentVisitorIp } from "../http/visitor-ip.server";

/** The visitor's address, as the platform resolves it, for per-visitor rate limits. */
export async function visitorAddress(): Promise<string> {
  return currentVisitorIp();
}

/** The page the visitor sent a form from, as a path; undefined when it is not ours to record. */
export async function sourcePage(): Promise<string | undefined> {
  const referer = (await headers()).get("referer");
  if (!referer) return undefined;
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}`.slice(0, 300);
  } catch {
    return undefined;
  }
}
