import type { EnquiryStatus } from "@auction/domain";
import type { EnquiryAbilities } from "./enquiry-access";

type Record_ = { status: EnquiryStatus; nextStatuses: readonly EnquiryStatus[] };

/** What a person can do on one enquiry: the buttons the record shows, and nothing else. */
export type EnquiryRecordActions = {
  access: "full" | "read-only";
  /** The next step in the enquiry's life, when there is one. */
  primary: { kind: "start" | "reopen"; to: "in_progress" } | null;
  /** Other statuses it can be moved to by hand, in the order the menu lists them. */
  moves: ReadonlyArray<"in_progress" | "waiting_on_client">;
  canClose: boolean;
  canAssign: boolean;
  canNote: boolean;
};

const MOVABLE = ["in_progress", "waiting_on_client"] as const;

const OPEN: readonly EnquiryStatus[] = ["new", "in_progress", "waiting_on_client"];

/**
 * Derived from the domain's own next statuses, so the screen never offers a move the API would
 * refuse. A converted enquiry now belongs to its deal and offers no status change.
 */
export function enquiryRecordActions(
  enquiry: Record_,
  abilities: Pick<EnquiryAbilities, "canWork">,
): EnquiryRecordActions {
  if (!abilities.canWork) {
    return {
      access: "read-only",
      primary: null,
      moves: [],
      canClose: false,
      canAssign: false,
      canNote: false,
    };
  }
  const next = new Set(enquiry.nextStatuses);
  const primary: EnquiryRecordActions["primary"] =
    enquiry.status === "new" && next.has("in_progress")
      ? { kind: "start", to: "in_progress" }
      : enquiry.status === "closed" && next.has("in_progress")
        ? { kind: "reopen", to: "in_progress" }
        : null;
  return {
    access: "full",
    primary,
    moves: MOVABLE.filter((status) => next.has(status) && status !== primary?.to),
    canClose: next.has("closed"),
    canAssign: OPEN.includes(enquiry.status),
    canNote: true,
  };
}

/** Still needs someone: new, in progress, or waiting on the client. */
export function isOpenEnquiry(status: EnquiryStatus): boolean {
  return OPEN.includes(status);
}
