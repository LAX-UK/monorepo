import "server-only";

import { headers } from "next/headers";
import { safeHopNext } from "./account-link";

/** The client-area page being rendered, path and query, as the middleware passed it on. */
export async function resolveClientRequestPath(): Promise<string> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname");
  if (!pathname) return safeHopNext(null);
  return safeHopNext(`${pathname}${requestHeaders.get("x-search") ?? ""}`);
}
