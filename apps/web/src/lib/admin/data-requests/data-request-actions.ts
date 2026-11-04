import type {
  DataRequestOutcome,
  DataRequestProduct,
  DataRequestRecord,
  DataRequestView,
  ManualRequestView,
} from "@auction/identity-contracts/data-requests";
import { formatDay } from "./data-requests.vm";

/**
 * What a person may do on one request, decided in one place from the record and the London day.
 * It repeats Identity's rules so a button is hidden when it can never apply and disabled, with
 * the reason, when only the request's state blocks it; Identity still refuses anything the page
 * got wrong.
 */
export type ActionState =
  /** Not offered: it never applies to this request or this person. */
  | { kind: "hidden" }
  /** Offered but blocked, and the reason says why. */
  | { kind: "disabled"; reason: string }
  | { kind: "enabled" };

const HIDDEN: ActionState = { kind: "hidden" };
const ENABLED: ActionState = { kind: "enabled" };
const disabled = (reason: string): ActionState => ({ kind: "disabled", reason });

export const OWN_REQUEST_REASON = "Another person must handle a request about you";

export type RecordActions = {
  /** Set when the signed-in person is the subject: the page is view only. */
  viewOnlyReason: string | null;
  extend: ActionState;
  close: ActionState;
  continueManually: ActionState;
  recordIdReceived: ActionState;
  editNotes: ActionState;
  /** Mark a product gathered; unmarking is always possible while the request is open. */
  gather: (product: DataRequestProduct) => ActionState;
  /** The next step in the request's life, or none when there is no next step. */
  primary: "close" | "id-received" | null;
};

const NONE: Omit<RecordActions, "viewOnlyReason"> = {
  extend: HIDDEN,
  close: HIDDEN,
  continueManually: HIDDEN,
  recordIdReceived: HIDDEN,
  editNotes: HIDDEN,
  gather: () => HIDDEN,
  primary: null,
};

/**
 * Extending is offered for a manual request that is open, running, not yet extended and still
 * inside its original due date. The request's due date is the original one until it is extended.
 */
export function extendState(
  request: Pick<ManualRequestView, "status" | "dueOn" | "extended" | "due">,
): ActionState {
  if (request.status === "closed") return HIDDEN;
  if (request.status === "waiting_for_id" || request.dueOn === null) {
    return disabled("Starts once proof of identity arrives.");
  }
  if (request.extended) return disabled("Already extended once.");
  if (request.due.state === "overdue") {
    return disabled(`The original due date, ${formatDay(request.dueOn)}, has passed.`);
  }
  return ENABLED;
}

/** The actions a list row's menu offers, from the row alone. */
export type RowActions = {
  continueManually: ActionState;
  extend: ActionState;
  close: ActionState;
};

const NO_ROW_ACTIONS: RowActions = { continueManually: HIDDEN, extend: HIDDEN, close: HIDDEN };

export function rowActions(request: DataRequestView): RowActions {
  if (request.kind === "download") {
    const canContinue =
      (request.status === "delayed" || request.status === "failed") && request.continuedAs === null;
    return { ...NO_ROW_ACTIONS, continueManually: canContinue ? ENABLED : HIDDEN };
  }
  if (request.status === "closed") return NO_ROW_ACTIONS;
  return { continueManually: HIDDEN, extend: extendState(request), close: ENABLED };
}

export function recordActions(record: DataRequestRecord): RecordActions {
  if (record.ownRequest) return { ...NONE, viewOnlyReason: OWN_REQUEST_REASON };
  const { request } = record;

  if (request.kind === "download") {
    return {
      ...NONE,
      viewOnlyReason: null,
      continueManually: rowActions(request).continueManually,
    };
  }

  if (request.status === "closed") return { ...NONE, viewOnlyReason: null };

  const waiting = request.status === "waiting_for_id";
  return {
    viewOnlyReason: null,
    extend: extendState(request),
    close: ENABLED,
    continueManually: HIDDEN,
    recordIdReceived: waiting ? ENABLED : HIDDEN,
    editNotes: ENABLED,
    gather: (product) => {
      if (!request.products.includes(product)) return HIDDEN;
      if (isGathered(record, product)) return ENABLED;
      return waiting ? disabled("Record when the proof of identity arrived first.") : ENABLED;
    },
    primary: waiting ? "id-received" : "close",
  };
}

/** Outcomes that say a copy was dealt with: they need the clock to be running. */
const NEEDS_RUNNING_CLOCK: ReadonlySet<DataRequestOutcome> = new Set([
  "sent",
  "sent_partial",
  "nothing_held",
]);

/** Whether an outcome can be chosen now; a request still waiting for ID can only be refused or withdrawn. */
export function outcomeState(
  outcome: DataRequestOutcome,
  request: Pick<ManualRequestView, "status">,
): ActionState {
  return request.status === "waiting_for_id" && NEEDS_RUNNING_CLOCK.has(outcome)
    ? disabled("Available once proof of identity arrives and the clock starts.")
    : ENABLED;
}

export function isGathered(record: DataRequestRecord, product: DataRequestProduct): boolean {
  return Boolean(record.steps.find((step) => step.product === product)?.gatheredAt);
}
