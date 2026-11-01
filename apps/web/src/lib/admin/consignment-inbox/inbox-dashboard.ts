import { LONDON_WORKING_CALENDAR, workingMinutesBetween } from "@auction/domain";
import type { AttentionItem } from "@auction/staff-ui";
import type { ConsignmentInboxSummary } from "@auction/validators";
import { INBOX_PATH } from "./inbox-list-state";
import { workingDurationWords } from "./inbox-presenters";

/**
 * The inbox's two queues on the Dashboard: client messages waiting on this person, and, for
 * people who can assign, the ones nobody has. Each links to that exact filter and drops out at
 * zero.
 */
export function inboxDashboardQueues(
  summary: ConsignmentInboxSummary,
  input: { canAssign: boolean; now: Date },
): AttentionItem[] {
  const waited = (iso: string | null) =>
    iso
      ? workingDurationWords(
          workingMinutesBetween(LONDON_WORKING_CALENDAR, new Date(iso), input.now),
        )
      : null;
  const items: AttentionItem[] = [];
  const mine = summary.mine;
  if (mine.waiting > 0) {
    const oldest = waited(mine.oldestWaitingSince);
    items.push({
      id: "inbox-mine",
      label:
        mine.waiting === 1 ? "client message waiting on you" : "client messages waiting on you",
      count: mine.waiting,
      href: `${INBOX_PATH}?view=mine`,
      ...(oldest
        ? {
            oldest:
              mine.overdue > 0 ? `oldest ${oldest} · ${mine.overdue} overdue` : `oldest ${oldest}`,
          }
        : {}),
      tone: mine.overdue > 0 ? "danger" : "neutral",
    });
  }
  const unassigned = summary.unassigned;
  if (input.canAssign && unassigned.waiting > 0) {
    const oldest = waited(unassigned.oldestWaitingSince);
    const who = unassigned.oldestAccountName;
    items.push({
      id: "inbox-unassigned",
      label: unassigned.waiting === 1 ? "unassigned client message" : "unassigned client messages",
      count: unassigned.waiting,
      href: `${INBOX_PATH}?specialist=unassigned`,
      ...(oldest ? { oldest: who ? `${who} · waiting ${oldest}` : `waiting ${oldest}` } : {}),
      tone: "warning",
    });
  }
  return items;
}
