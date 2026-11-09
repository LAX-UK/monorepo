import {
  type CollectionCancelReason,
  type CollectionCancelledVia,
  buildCollectionIcs,
  collectionCalendarFilename,
  formatCollectionDay,
  formatCollectionVisit,
  formatCollectionWhen,
} from "@auction/domain";
import type { EmailEnqueueInput, TemplateName, TemplateVarsByName } from "@auction/email";

/** Someone an email can go to. */
export type NoticeRecipient = {
  userId: string;
  email: string;
  firstName: string | null;
};

/** The visit as the emails need it, read when the email is made. */
export type CollectionNoticeVisit = {
  bookingId: string;
  reference: string;
  slotStart: Date;
  slotEnd: Date;
  icsSequence: number;
  bookedVia: "client" | "staff";
  collector: { kind: "self" | "member" | "third_party"; name: string; email: string | null };
  place: { name: string; address: string };
  lots: { title: string; lotNumber: number | null; active: boolean }[];
  /** Who booked it, when they still have an account. */
  booker: (NoticeRecipient & { name: string }) | null;
  /** The account's owners and admins: who hears when the booker cannot. */
  accountPeople: NoticeRecipient[];
};

export type CollectionChange =
  | { kind: "created"; eventId: number | string; noticeDeadline: Date | null }
  | {
      kind: "changed";
      eventId: number | string;
      previousSlotStart: Date;
      noticeDeadline: Date | null;
    }
  | {
      kind: "cancelled";
      eventId: number | string;
      cancelledVia: CollectionCancelledVia;
      reason?: CollectionCancelReason | undefined;
    }
  | { kind: "reminder" };

export type CollectionNoticeConfig = {
  /** The sender of the calendar invites: mail clients need an organizer to update the entry. */
  organizer: { email: string; name: string };
  /** Where the buyer manages a collection. */
  webOrigin: string;
  now: Date;
};

type CollectionTemplate = Extract<TemplateName, `collection-${string}`>;
/** One collection email: the template with the variables it takes. */
type Message = {
  [T in CollectionTemplate]: {
    template: T;
    vars: TemplateVarsByName[T];
    recipientResolution?: "live" | "snapshot";
  };
}[CollectionTemplate];
type Enqueue = EmailEnqueueInput;

const ID_RULE =
  "Bring photo ID in that name: a passport, driving licence or national identity card.";

/** The gallery's reason for cancelling, as it reads in the sentence "{Reason}. We're sorry...". */
const GALLERY_REASONS: Partial<Record<CollectionCancelReason, string>> = {
  hours_changed: "our opening hours have changed",
  closure_added: "we're closed that day",
  opening_removed: "we're no longer open that day",
};

const lotLine = (lot: { title: string; lotNumber: number | null }) =>
  lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;

/** The lots the email is about: the live ones, or all of them once the visit has ended. */
const lotsFor = (visit: CollectionNoticeVisit, all: boolean) =>
  visit.lots.filter((lot) => all || lot.active).map(lotLine);

/**
 * The calendar entry for one recipient, or none when it cannot be made (an address the calendar
 * format refuses): the email still goes, because a missing invite is better than a missing email.
 */
function calendarFor(
  method: "REQUEST" | "CANCEL",
  visit: CollectionNoticeVisit,
  attendee: { email: string; name?: string | undefined },
  config: CollectionNoticeConfig,
  description: readonly string[],
) {
  try {
    return {
      filename: collectionCalendarFilename(visit.reference),
      method,
      content: buildCollectionIcs({
        method,
        organizer: config.organizer,
        attendee,
        reference: visit.reference,
        sequence: visit.icsSequence,
        start: visit.slotStart,
        end: visit.slotEnd,
        stamp: config.now,
        summary: `Collection at ${visit.place.name}`,
        location: visit.place.address,
        description,
      }),
    } as const;
  } catch {
    return null;
  }
}

/**
 * Who the buyer's email goes to: the person who booked; the account's owners and admins when the
 * desk booked it or the booker has gone.
 */
function buyerRecipients(visit: CollectionNoticeVisit): NoticeRecipient[] {
  // A visit the desk booked is for the client, never for the staff member who typed it in.
  if (visit.bookedVia === "staff") return visit.accountPeople;
  return visit.booker ? [visit.booker] : visit.accountPeople;
}

/**
 * The emails one booking event sends, and no more: the buyer's (with a calendar entry, never a
 * price) and, for someone named to collect, theirs. Pure: it reads nothing and sends nothing.
 * Every email carries a key that names the event and the address, so a retry sends nothing twice.
 */
export function collectionEmailsFor(
  change: CollectionChange,
  visit: CollectionNoticeVisit,
  config: CollectionNoticeConfig,
): Enqueue[] {
  const emails: Enqueue[] = [];
  const keyOf = (email: string) =>
    change.kind === "reminder"
      ? `collection-reminder:${visit.bookingId}:${visit.slotStart.toISOString()}:${email.toLowerCase()}`
      : `collection-${change.kind}:${change.eventId}:${email.toLowerCase()}`;
  const sentTo = new Set<string>();
  const add = (to: string, userId: string | undefined, message: Message) => {
    const address = to.toLowerCase();
    if (sentTo.has(address)) return;
    sentTo.add(address);
    emails.push({
      ...message,
      to,
      ...(userId ? { userId } : {}),
      idempotencyKey: keyOf(to),
      category: "transactional",
    } as Enqueue);
  };

  const bookingUrl = `${config.webOrigin}/purchases`;
  const dayLabel = formatCollectionDay(visit.slotStart, config.now);
  const whenLabel = formatCollectionVisit(visit.slotStart, visit.slotEnd, config.now);
  const collectorIsOther = visit.collector.kind !== "self";
  const idLines = (collectorName: string) => [
    ...lotsFor(visit, change.kind === "cancelled"),
    `Collecting: ${collectorName}`,
    ID_RULE,
    `Reference ${visit.reference}`,
  ];

  for (const person of buyerRecipients(visit)) {
    const base = {
      userName: person.firstName,
      reference: visit.reference,
      whenLabel,
      placeName: visit.place.name,
      address: visit.place.address,
      lots: lotsFor(visit, false),
      collectorName: visit.collector.name,
      collectorIsOther,
      bookingUrl,
    };
    const calendar = (method: "REQUEST" | "CANCEL") =>
      calendarFor(
        method,
        visit,
        { email: person.email, name: person.firstName ?? undefined },
        config,
        idLines(visit.collector.name),
      );
    switch (change.kind) {
      case "created":
        add(person.email, person.userId, {
          template: "collection-booked",
          vars: {
            ...base,
            calendar: calendar("REQUEST"),
            ...(change.noticeDeadline
              ? { changeUntilLabel: formatCollectionWhen(change.noticeDeadline, config.now) }
              : {}),
          } satisfies TemplateVarsByName["collection-booked"],
        });
        break;
      case "changed":
        add(person.email, person.userId, {
          template: "collection-changed",
          vars: {
            ...base,
            previousWhenLabel: formatCollectionWhen(change.previousSlotStart, config.now),
            calendar: calendar("REQUEST"),
            ...(change.noticeDeadline
              ? { changeUntilLabel: formatCollectionWhen(change.noticeDeadline, config.now) }
              : {}),
          } satisfies TemplateVarsByName["collection-changed"],
        });
        break;
      case "reminder":
        add(person.email, person.userId, {
          template: "collection-reminder",
          vars: {
            ...base,
            timeLabel: formatCollectionWhen(visit.slotStart, config.now).split(", ").pop() ?? "",
          } satisfies TemplateVarsByName["collection-reminder"],
        });
        break;
      case "cancelled": {
        const cancelledBy =
          change.reason === "account_erased"
            ? "account"
            : change.cancelledVia === "client"
              ? "buyer"
              : "gallery";
        add(person.email, person.userId, {
          template: "collection-cancelled",
          vars: {
            userName: person.firstName,
            reference: visit.reference,
            dayLabel,
            lots: lotsFor(visit, true),
            cancelledBy,
            reasonText: change.reason ? (GALLERY_REASONS[change.reason] ?? null) : null,
            bookUrl: bookingUrl,
            calendar: calendar("CANCEL"),
          } satisfies TemplateVarsByName["collection-cancelled"],
        });
        break;
      }
    }
  }

  // Someone named to collect hears too, with their own calendar entry and nothing about money.
  const collectorEmail = visit.collector.email;
  if (visit.collector.kind === "third_party" && collectorEmail && change.kind !== "reminder") {
    const bookerName = visit.booker?.name ?? visit.booker?.firstName ?? "the buyer";
    const calendar = (method: "REQUEST" | "CANCEL") =>
      calendarFor(
        method,
        visit,
        { email: collectorEmail, name: visit.collector.name },
        config,
        idLines(visit.collector.name),
      );
    if (change.kind === "cancelled") {
      add(collectorEmail, undefined, {
        template: "collection-cancelled",
        recipientResolution: "snapshot",
        vars: {
          userName: visit.collector.name,
          forCollector: { bookerName },
          reference: visit.reference,
          dayLabel,
          lots: lotsFor(visit, true).map((line) => line.replace(/^Lot \d+ · /, "")),
          cancelledBy: "buyer",
          bookUrl: bookingUrl,
          calendar: calendar("CANCEL"),
        } satisfies TemplateVarsByName["collection-cancelled"],
      });
    } else {
      add(collectorEmail, undefined, {
        template: "collection-collector-notice",
        recipientResolution: "snapshot",
        vars: {
          collectorName: visit.collector.name,
          bookerName,
          reference: visit.reference,
          whenLabel,
          dayLabel,
          placeName: visit.place.name,
          address: visit.place.address,
          lots: visit.lots.filter((lot) => lot.active).map((lot) => lot.title),
          calendar: calendar("REQUEST"),
        } satisfies TemplateVarsByName["collection-collector-notice"],
      });
    }
  }
  return emails;
}
