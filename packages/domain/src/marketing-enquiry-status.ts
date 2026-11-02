import {
  type EnquiryCloseReason,
  type EnquiryIntent,
  type EnquiryStatus,
  isPrivateSaleEnquiryIntent,
} from "./marketing-enquiry-vocabulary.js";

export type EnquiryTransitionRefusal =
  | "unchanged"
  | "not_allowed"
  | "close_reason_required"
  | "close_reason_not_applicable"
  | "conversion_unavailable"
  | "conversion_not_manual";

export type EnquiryTransitionRequest = {
  from: EnquiryStatus;
  to: EnquiryStatus;
  intent: EnquiryIntent;
  closeReason?: EnquiryCloseReason | null | undefined;
  /** True when a person set the status by hand rather than the convert flow. */
  manual: boolean;
};

type Guard = (request: EnquiryTransitionRequest) => EnquiryTransitionRefusal | null;

const GUARDS = {
  closeReason: (r) => (r.closeReason ? null : "close_reason_required"),
  privateSaleOnly: (r) => (isPrivateSaleEnquiryIntent(r.intent) ? null : "conversion_unavailable"),
  throughConvert: (r) => (r.manual ? "conversion_not_manual" : null),
} satisfies Record<string, Guard>;

type GuardName = keyof typeof GUARDS;

/** Each status lists where it may go next, and what each move needs. */
const TRANSITIONS: Record<EnquiryStatus, Partial<Record<EnquiryStatus, readonly GuardName[]>>> = {
  new: { in_progress: [], waiting_on_client: [], closed: ["closeReason"] },
  in_progress: {
    waiting_on_client: [],
    closed: ["closeReason"],
    converted: ["privateSaleOnly", "throughConvert"],
  },
  waiting_on_client: {
    in_progress: [],
    closed: ["closeReason"],
    converted: ["privateSaleOnly", "throughConvert"],
  },
  // A closed enquiry can be reopened; a converted one now belongs to its deal.
  closed: { in_progress: [] },
  converted: {},
};

/** Null when the move is allowed, otherwise why not. */
export function enquiryTransitionRefusal(
  request: EnquiryTransitionRequest,
): EnquiryTransitionRefusal | null {
  if (request.from === request.to) return "unchanged";
  const guards = TRANSITIONS[request.from][request.to];
  if (!guards) return "not_allowed";
  if (request.to !== "closed" && request.closeReason) return "close_reason_not_applicable";
  for (const name of guards) {
    const refusal = GUARDS[name](request);
    if (refusal) return refusal;
  }
  return null;
}

/** Where an enquiry in `from` may go, for the status control. */
export function enquiryNextStatuses(from: EnquiryStatus): EnquiryStatus[] {
  return Object.keys(TRANSITIONS[from]) as EnquiryStatus[];
}
