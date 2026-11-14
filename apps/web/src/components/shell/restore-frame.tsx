import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { ReportRestoreStalled } from "@/components/layout/account-switcher/report-restore-stalled";
import { AccountRestoreFrame } from "@/components/shell/account-restore-frame";
import { AccountsUnavailableFrame } from "@/components/shell/accounts-unavailable-frame";
import { pendingRestore } from "@/lib/legal-entity/pending-restore.server";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";

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
