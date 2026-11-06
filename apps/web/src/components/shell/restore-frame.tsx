import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { AccountRestoreFrame } from "@/components/shell/account-restore-frame";
import { AccountsUnavailableFrame } from "@/components/shell/accounts-unavailable-frame";
import { RESTORE_MARKER_COOKIE, nextRestoreStep } from "@/lib/legal-entity/restore-loop";
import { restoreAccountHref } from "@/lib/navigation/account-link";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { reportRestoreStalled } from "@/lib/observability/report-restore-stalled";
import { cookies } from "next/headers";

type Pending = { step: "hop" | "stalled"; href: string };

/**
 * Whether this request must first put the browser in its account, and through which hop. A
 * restore that has only just run and not taken is `stalled`: it is reported, and the caller shows
 * the retry state instead of hopping again, so the browser can never loop.
 */
async function pendingRestore(needsRestore: boolean, returnTo: string): Promise<Pending | null> {
  const markerPresent = (await cookies()).has(RESTORE_MARKER_COOKIE);
  const step = nextRestoreStep({ needsRestore, markerPresent });
  if (step === "none") return null;
  const href = restoreAccountHref(returnTo);
  if (step === "stalled") reportRestoreStalled(href);
  return { step, href };
}

/**
 * What the client area draws while this browser has no usable account, or `null` when it has
 * one: the restore hop, opened as a page, or the retry state, each in the lax.bid frame.
 */
export async function restoreFrameFor(needsRestore: boolean) {
  const pending = await pendingRestore(needsRestore, await resolveClientRequestPath());
  if (!pending) return null;
  return pending.step === "hop" ? (
    <AccountRestoreFrame href={pending.href} />
  ) : (
    <AccountsUnavailableFrame retry={{ kind: "link", href: pending.href }} />
  );
}

/** The same for a public page that bids as the client (it already has the site frame). */
export async function restoreContentFor(needsRestore: boolean, returnTo: string) {
  const pending = await pendingRestore(needsRestore, returnTo);
  if (!pending) return null;
  return pending.step === "hop" ? (
    <AccountRestoreHop href={pending.href} />
  ) : (
    <AccountsUnavailable retry={{ kind: "link", href: pending.href }} />
  );
}
