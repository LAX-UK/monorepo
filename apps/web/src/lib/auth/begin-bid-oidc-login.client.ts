"use client";

import { isSafeNextPath } from "./post-auth-destination";

/** Starts a top-level OIDC authorization flow; never use an iframe or client-side token handoff. */
export function beginBidOidcLogin(next: string | null | undefined): void {
  const safeNext = next && isSafeNextPath(next) ? next : "/dashboard";
  window.location.assign(`/api/auth/login?next=${encodeURIComponent(safeNext)}`);
}
