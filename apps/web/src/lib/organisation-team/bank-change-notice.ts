import type { ActivityEntryView } from "@/lib/data/http/organisation-team.types";
import { formatDateInline } from "@/lib/ui/format";

/** How long the Payouts tab keeps telling owners and admins about a payout account change. */
export const BANK_CHANGE_NOTICE_DAYS = 30;

export type BankChangeNotice = { title: string; body: string };

/**
 * The notice every owner and admin sees after the payout account changes: when and by whom, and
 * what to do if they didn't expect it. From the newest change in the window, or `null`.
 */
export function bankChangeNotice(
  entries: readonly ActivityEntryView[],
  now: Date,
): BankChangeNotice | null {
  const since = now.getTime() - BANK_CHANGE_NOTICE_DAYS * 86_400_000;
  const change = entries
    .filter((e) => e.kind === "bank_details_changed" && new Date(e.occurredAt).getTime() >= since)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (!change) return null;
  return {
    title: `The payout account was changed on ${formatDateInline(change.occurredAt)} by ${change.actorName}.`,
    body: "We emailed every owner and admin. If you didn't expect this, contact us now and we'll hold payouts.",
  };
}
