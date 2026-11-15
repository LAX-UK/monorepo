import "server-only";

import { RESTORE_MARKER_COOKIE, nextRestoreStep } from "@/lib/legal-entity/restore-loop";
import { restoreAccountHref } from "@/lib/navigation/account-link";
import { cookies } from "next/headers";

export type PendingRestore = { step: "hop" | "stalled"; href: string };

/**
 * Whether this request must first put the browser in its account, and through which hop. A
 * restore that has only just run and not taken is `stalled`: the caller shows the retry state
 * (and reports it) instead of hopping again, so the browser can never loop.
 *
 * Kept apart from `restore-frame`, which renders client components: a route handler that imports
 * this (`GET /api/lots/:id/me`) must not pull those components into a client entry of its own,
 * which reshapes the shared chunks every page loads.
 */
export async function pendingRestore(
  needsRestore: boolean,
  returnTo: string,
): Promise<PendingRestore | null> {
  const markerPresent = (await cookies()).has(RESTORE_MARKER_COOKIE);
  const step = nextRestoreStep({ needsRestore, markerPresent });
  if (step === "none") return null;
  return { step, href: restoreAccountHref(returnTo) };
}
