import "server-only";

import { headers } from "next/headers";
import { adminReturnPath } from "./admin-return-path";

/** The current admin page (path and query, supplied by middleware) to return to after sign-in. */
export async function resolveAdminReturnPath(): Promise<string> {
  const requestHeaders = await headers();
  return adminReturnPath(requestHeaders.get("x-pathname"), requestHeaders.get("x-search"));
}
