import type { ItemSubmissionStatus, SellerIdentityReminderState } from "@auction/types";

/**
 * A specialist who cannot accept a work because the seller's identity is not verified can
 * remind the seller, at most once a day per consignment. Pressing it again inside that window
 * changes nothing, so a double click or a second specialist never sends twice.
 */
export const SELLER_IDENTITY_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Acceptance waits on the seller's identity only while the work is under review. */
const REMINDABLE_STATUSES: ReadonlySet<ItemSubmissionStatus> = new Set(["under_review"]);

export type SellerIdentityReminderDecision =
  | { kind: "send" }
  /** Already sent inside the window; nothing is sent again. */
  | { kind: "already_sent"; lastSentAt: Date; nextAllowedAt: Date }
  | { kind: "not_needed"; reason: "identity_verified" | "not_under_review" };

export function sellerIdentityReminderState(lastSentAt: Date | null): SellerIdentityReminderState {
  return {
    lastSentAt,
    nextAllowedAt: lastSentAt
      ? new Date(lastSentAt.getTime() + SELLER_IDENTITY_REMINDER_INTERVAL_MS)
      : null,
  };
}

export function decideSellerIdentityReminder(input: {
  submissionStatus: ItemSubmissionStatus;
  identityVerified: boolean;
  lastSentAt: Date | null;
  now: Date;
}): SellerIdentityReminderDecision {
  if (!REMINDABLE_STATUSES.has(input.submissionStatus)) {
    return { kind: "not_needed", reason: "not_under_review" };
  }
  if (input.identityVerified) return { kind: "not_needed", reason: "identity_verified" };
  const { lastSentAt, nextAllowedAt } = sellerIdentityReminderState(input.lastSentAt);
  if (lastSentAt && nextAllowedAt && input.now.getTime() < nextAllowedAt.getTime()) {
    return { kind: "already_sent", lastSentAt, nextAllowedAt };
  }
  return { kind: "send" };
}

export const SELLER_IDENTITY_REMINDER_NOT_NEEDED_MESSAGE: Record<
  Extract<SellerIdentityReminderDecision, { kind: "not_needed" }>["reason"],
  string
> = {
  identity_verified: "The seller's identity is already verified.",
  not_under_review: "A reminder is only sent while the work is under review.",
};
