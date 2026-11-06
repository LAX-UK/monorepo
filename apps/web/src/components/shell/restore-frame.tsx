import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { ReportRestoreStalled } from "@/components/layout/account-switcher/report-restore-stalled";
import { AccountRestoreFrame } from "@/components/shell/account-restore-frame";
import { AccountsUnavailableFrame } from "@/components/shell/accounts-unavailable-frame";
import { RESTORE_MARKER_COOKIE, nextRestoreStep } from "@/lib/legal-entity/restore-loop";
import { restoreAccountHref } from "@/lib/navigation/account-link";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { cookies } from "next/headers";

type Pending = { step: "hop" | "stalled"; href: string };

/**
 * Whether this request must first put the browser in its account, and through which hop. A
 * restore that has only just run and not taken is `stalled`: the caller shows the retry state
 * (and reports it) instead of hopping again, so the browser can never loop.
 */
async function pendingRestore(needsRestore: boolean, returnTo: string): Promise<Pending | null> {
  const markerPresent = (await cookies()).has(RESTORE_MARKER_COOKIE);
  const step = nextRestoreStep({ needsRestore, markerPresent });
  if (step === "none") return null;
  return { step, href: restoreAccountHref(returnTo) };
}

/**
 * What the client area draws while this browser has no usable account, or `null` when it has
 * one: the restore hop, opened as a page, or the retry state, each in the lax.bid frame.
 */
export async function restoreFrameFor(needsRestore: boolean) {
  const returnTo = await resolveClientRequestPath();
  const pending = await pendingRestore(needsRestore, returnTo);
  if (!pending) return null;
  return pending.step === "hop" ? (
    <AccountRestoreFrame href={pending.href} />
  ) : (
    <ReportRestoreStalled returnTo={returnTo}>
      <AccountsUnavailableFrame retry={{ kind: "link", href: pending.href }} />
    </ReportRestoreStalled>
  );
}

/** The same for a public page that bids as the client (it already has the site frame). */
export async function restoreContentFor(needsRestore: boolean, returnTo: string) {
  const pending = await pendingRestore(needsRestore, returnTo);
  if (!pending) return null;
  return pending.step === "hop" ? (
    <AccountRestoreHop href={pending.href} />
  ) : (
    <ReportRestoreStalled returnTo={returnTo}>
      <AccountsUnavailable retry={{ kind: "link", href: pending.href }} />
    </ReportRestoreStalled>
  );
}
