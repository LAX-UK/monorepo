import type {
  ConsignmentAgreement,
  ItemSubmission,
  LotStatus,
  LotWithdrawalRequestState,
  UnsoldLotChoice,
  UnsoldLotChoiceKind,
} from "@auction/types";
import type { ConsignmentMessage } from "./consignment-thread";
import { messageFullTime, messageTime } from "./consignment-thread";
import { UNSOLD_CHOICE_OPTIONS } from "./unsold-choice-view";

/** What an event is about; the page draws one icon per kind. */
export type ConsignmentEventKind =
  | "started"
  | "sent"
  | "changes"
  | "reviewed"
  | "declined"
  | "agreement_sent"
  | "agreement_accepted"
  | "catalogued"
  | "sale_opened"
  | "sold"
  | "unsold"
  | "choice"
  | "withdrawal"
  | "paid_out"
  | "message";

export type ConsignmentEvent = {
  id: string;
  kind: ConsignmentEventKind;
  at: Date;
  title: string;
  /** Who did it, or what was said; `null` when the title says it all. */
  detail: string | null;
};

export type ConsignmentEventView = ConsignmentEvent & {
  /** "27 Oct", or the time today. */
  time: string;
  dateTime: string;
  fullTime: string;
};

/**
 * What the history reads. There is no event log for a consignment, so the history is read from
 * the timestamps its records keep: each record holds its latest step, so a step taken twice
 * (changes asked again) shows once, at its latest time.
 */
export type ConsignmentHistorySources = {
  submission: Pick<
    ItemSubmission,
    | "status"
    | "createdAt"
    | "updatedAt"
    | "reviewedAt"
    | "rejectionReason"
    | "changesRequestedAt"
    | "changesRequestedNote"
    | "sentBy"
  >;
  agreement: Pick<
    ConsignmentAgreement,
    "proposedAt" | "acceptedAt" | "acceptedByName" | "estimateLow"
  > | null;
  lot: {
    status: LotStatus;
    createdAt: Date;
    startTime: Date;
    endTime: Date;
    sold: boolean;
    saleTitle: string | null;
  } | null;
  unsoldChoice: Pick<
    UnsoldLotChoice,
    "requestedChoice" | "requestedAt" | "requestedByName" | "decidedChoice" | "decidedAt"
  > | null;
  withdrawal: LotWithdrawalRequestState | null;
  /** The thread; `null` when it could not be read or the member may not read it. */
  messages: readonly ConsignmentMessage[] | null;
  /** When the sale's money was paid out; `null` when unpaid or not shown to the member. */
  paidOutAt: Date | null;
  now: Date;
};

const PAST_REVIEW = new Set<ItemSubmission["status"]>(["approved", "converted"]);
const EXCERPT = 120;

/** "relist it", "sell it privately": the choice's label inside a sentence. */
function choiceWords(kind: UnsoldLotChoiceKind): string {
  const label = UNSOLD_CHOICE_OPTIONS[kind].label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT - 1).trimEnd()}…` : flat;
}

function submissionEvents(s: ConsignmentHistorySources["submission"]): ConsignmentEvent[] {
  const events: ConsignmentEvent[] = [];
  const by = s.sentBy?.name ? `By ${s.sentBy.name}` : null;
  events.push(
    s.status === "draft"
      ? { id: "started", kind: "started", at: s.createdAt, title: "Draft started", detail: by }
      : {
          id: "sent",
          kind: "sent",
          at: s.createdAt,
          title: "Sent to our specialists",
          detail: by,
        },
  );
  if (s.changesRequestedAt) {
    events.push({
      id: "changes",
      kind: "changes",
      at: s.changesRequestedAt,
      title: "Your specialist asked for changes",
      detail: s.changesRequestedNote ? excerpt(s.changesRequestedNote) : null,
    });
  }
  // Asking for changes also stamps the review; only a later decision is a review of its own.
  const ownReview =
    s.reviewedAt && s.reviewedAt.getTime() !== s.changesRequestedAt?.getTime()
      ? s.reviewedAt
      : null;
  if (ownReview && s.status === "rejected") {
    events.push({
      id: "declined",
      kind: "declined",
      at: ownReview,
      title: "Our specialists decided not to take it on",
      detail: s.rejectionReason ? excerpt(s.rejectionReason) : null,
    });
  } else if (ownReview && PAST_REVIEW.has(s.status)) {
    events.push({
      id: "reviewed",
      kind: "reviewed",
      at: ownReview,
      title: "Reviewed and accepted for sale",
      detail: null,
    });
  }
  if (s.status === "withdrawn") {
    events.push({
      id: "withdrawn",
      kind: "withdrawal",
      at: s.updatedAt,
      title: "Withdrawn",
      detail: null,
    });
  }
  return events;
}

function agreementEvents(a: ConsignmentHistorySources["agreement"]): ConsignmentEvent[] {
  if (!a) return [];
  const events: ConsignmentEvent[] = [];
  // An agreement with no estimate yet is a placeholder, not something sent.
  if (a.estimateLow != null) {
    events.push({
      id: "agreement-sent",
      kind: "agreement_sent",
      at: a.proposedAt,
      title: "Agreement sent to you",
      detail: null,
    });
  }
  if (a.acceptedAt) {
    events.push({
      id: "agreement-accepted",
      kind: "agreement_accepted",
      at: a.acceptedAt,
      title: "Agreement accepted",
      detail: a.acceptedByName ? `By ${a.acceptedByName}` : null,
    });
  }
  return events;
}

function lotEvents(lot: ConsignmentHistorySources["lot"], now: Date): ConsignmentEvent[] {
  if (!lot || lot.status === "voided") return [];
  const events: ConsignmentEvent[] = [
    {
      id: "catalogued",
      kind: "catalogued",
      at: lot.createdAt,
      title: lot.saleTitle ? `Catalogued for ${lot.saleTitle}` : "Catalogued",
      detail: null,
    },
  ];
  const opened = lot.status === "active" || lot.status === "ended";
  if (opened && lot.startTime <= now) {
    events.push({
      id: "sale-opened",
      kind: "sale_opened",
      at: lot.startTime,
      title: "Bidding opened",
      detail: lot.saleTitle,
    });
  }
  if (lot.status === "ended") {
    events.push(
      lot.sold
        ? { id: "sold", kind: "sold", at: lot.endTime, title: "Sold", detail: null }
        : { id: "unsold", kind: "unsold", at: lot.endTime, title: "Did not sell", detail: null },
    );
  }
  return events;
}

function afterSaleEvents(sources: ConsignmentHistorySources): ConsignmentEvent[] {
  const events: ConsignmentEvent[] = [];
  const choice = sources.unsoldChoice;
  if (choice?.requestedChoice && choice.requestedAt) {
    events.push({
      id: "choice-requested",
      kind: "choice",
      at: choice.requestedAt,
      title: `Asked to ${choiceWords(choice.requestedChoice)}`,
      detail: choice.requestedByName ? `By ${choice.requestedByName}` : null,
    });
  }
  if (choice?.decidedChoice && choice.decidedAt) {
    events.push({
      id: "choice-decided",
      kind: "choice",
      at: choice.decidedAt,
      title: `Your specialist agreed to ${choiceWords(choice.decidedChoice)}`,
      detail: null,
    });
  }
  const withdrawal = sources.withdrawal;
  if (withdrawal) {
    events.push({
      id: "withdrawal-requested",
      kind: "withdrawal",
      at: withdrawal.requestedAt,
      title: "Asked to withdraw it",
      detail: null,
    });
    if (withdrawal.decidedAt && withdrawal.status !== "pending") {
      events.push({
        id: "withdrawal-decided",
        kind: "withdrawal",
        at: withdrawal.decidedAt,
        title: withdrawal.status === "approved" ? "Withdrawal agreed" : "Withdrawal declined",
        detail: withdrawal.status === "declined" ? withdrawal.reason : null,
      });
    }
  }
  if (sources.paidOutAt) {
    events.push({
      id: "paid-out",
      kind: "paid_out",
      at: sources.paidOutAt,
      title: "Paid out",
      detail: null,
    });
  }
  return events;
}

function messageEvents(messages: ConsignmentHistorySources["messages"]): ConsignmentEvent[] {
  return (messages ?? []).map((message) => ({
    id: `message-${message.id}`,
    kind: "message",
    at: new Date(message.createdAt),
    title:
      message.side === "staff"
        ? `Message from ${message.author.name}`
        : `${message.author.name} wrote to your specialist`,
    detail: message.body.trim()
      ? excerpt(message.body)
      : message.attachments.length === 1
        ? "Sent a file"
        : `Sent ${message.attachments.length} files`,
  }));
}

/**
 * The consignment's history, newest first: from submission and review, the agreement, the sale
 * and what came after, with the messages in their place.
 */
export function consignmentHistory(sources: ConsignmentHistorySources): ConsignmentEventView[] {
  return [
    ...submissionEvents(sources.submission),
    ...agreementEvents(sources.agreement),
    ...lotEvents(sources.lot, sources.now),
    ...afterSaleEvents(sources),
    ...messageEvents(sources.messages),
  ]
    .filter((event) => event.at.getTime() <= sources.now.getTime())
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((event) => ({
      ...event,
      time: messageTime(event.at, sources.now),
      dateTime: event.at.toISOString(),
      fullTime: messageFullTime(event.at),
    }));
}
