import { formatCollectionDay, formatCollectionVisit, formatCollectionWhen } from "@auction/domain";
import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import {
  type CollectionChange,
  type CollectionNoticeVisit,
  GALLERY_REASONS,
  buyerRecipients,
} from "./collection-notices.js";

/** The collection visit notices the inbox shows; each one sits beside the email of the same name. */
export const COLLECTION_NOTICE_TYPES = {
  created: "collection_booked",
  changed: "collection_changed",
  cancelled: "collection_cancelled",
  reminder: "collection_reminder",
} as const;

const capitalised = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/**
 * The in-app notices one collection change writes: one per person the buyer's email goes to (the
 * person who booked; the account's owners and admins when the desk booked it or the booker has
 * gone), worded like that email and dated the same way. A named collector gets none: they may have
 * no account, and the visit is not theirs to manage. A hand-over and a missed visit have their
 * emails only. Pure: it reads nothing and writes nothing.
 *
 * Each notice names the account the visit was booked for, so a person who muted that organisation
 * does not see it; the mute-aware writer decides that, as it does for every in-app notice.
 */
export function collectionInAppNoticesFor(
  change: CollectionChange,
  visit: CollectionNoticeVisit,
  now: Date,
): CreateNotificationRow[] {
  const copy = noticeCopy(change, visit, now);
  if (!copy) return [];
  const seen = new Set<string>();
  const rows: CreateNotificationRow[] = [];
  for (const person of buyerRecipients(visit)) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    rows.push({ userId: person.userId, legalEntityId: visit.account.id, ...copy });
  }
  return rows;
}

function noticeCopy(
  change: CollectionChange,
  visit: CollectionNoticeVisit,
  now: Date,
): { type: string; title: string; message: string } | null {
  const whenLabel = formatCollectionVisit(visit.slotStart, visit.slotEnd, now);
  const where = `${whenLabel} at ${visit.place.name}`;
  const reference = `Reference ${visit.reference}.`;
  switch (change.kind) {
    case "created":
      return {
        type: COLLECTION_NOTICE_TYPES.created,
        title: "Collection booked",
        message: `${where}. ${reference}`,
      };
    case "changed":
      return {
        type: COLLECTION_NOTICE_TYPES.changed,
        title: "Collection changed",
        message: `Now ${where}, moved from ${formatCollectionWhen(change.previousSlotStart, now)}. ${reference}`,
      };
    case "reminder":
      return {
        type: COLLECTION_NOTICE_TYPES.reminder,
        title: "Your collection is tomorrow",
        message: `${where}. Bring photo ID in the collector's name. ${reference}`,
      };
    case "cancelled": {
      const day = formatCollectionDay(visit.slotStart, now);
      const ended = `Your collection on ${day} is cancelled.`;
      let next: string;
      if (change.reason === "account_erased") {
        next =
          "The person who booked it has left this account. Your lots stay with us until a new time is booked.";
      } else if (change.cancelledVia === "client") {
        next = "Your lots stay with us until you book again.";
      } else {
        const reason = change.reason ? GALLERY_REASONS[change.reason] : undefined;
        next = `${reason ? `${capitalised(reason)}. ` : ""}We're sorry for the change. You can book another time.`;
      }
      return {
        type: COLLECTION_NOTICE_TYPES.cancelled,
        title: "Collection cancelled",
        message: `${ended} ${next} ${reference}`,
      };
    }
    case "collected":
    case "missed":
      return null;
  }
}
