import type { ItemSubmission, Lot } from "@auction/types";

/** One row of the Selling overview's "needs your attention" list. */
export type SellerAttentionItem = {
  id: string;
  title: string;
  detail: string;
  /** Short tag shown on the row, e.g. "Not submitted". */
  status: string;
  href: string;
};

type Input = {
  submissions: readonly ItemSubmission[];
  lots: readonly Lot[];
  /** Payouts are required and the account being sold as has not finished setting them up. */
  payoutSetupIncomplete: boolean;
  /** Where payout setup lives for the account being sold as. */
  payoutSetupHref: string;
  /** The person must verify their identity before they can sell or be paid. */
  identityVerificationNeeded: boolean;
  /** False when the person's role cannot open payout setup, so the row would lead nowhere. */
  canOpenPayoutSetup: boolean;
  now: Date;
};

const CONSIGNMENTS = "/selling/consignments";
/** A rejection older than this is history, not a task. */
const REJECTION_RELEVANT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

function draftItems(submissions: readonly ItemSubmission[]): SellerAttentionItem[] {
  const drafts = submissions.filter((s) => s.status === "draft");
  const [only] = drafts;
  if (!only) return [];
  if (drafts.length === 1) {
    return [
      {
        id: `draft:${only.id}`,
        title: `Finish "${only.title}"`,
        detail: "Saved but not yet sent to our specialists for review.",
        status: "Not submitted",
        href: `/selling/consignments/${only.id}`,
      },
    ];
  }
  return [
    {
      id: "drafts",
      title: `Finish ${drafts.length} drafts`,
      detail: "Saved but not yet sent to our specialists for review.",
      status: "Not submitted",
      href: `${CONSIGNMENTS}?tab=drafts`,
    },
  ];
}

function rejectedItem(
  submissions: readonly ItemSubmission[],
  now: Date,
): SellerAttentionItem | null {
  const recent = submissions
    .filter(
      (s) =>
        s.status === "rejected" &&
        now.getTime() - s.updatedAt.getTime() <= REJECTION_RELEVANT_DAYS * DAY_MS,
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (!recent) return null;
  return {
    id: `rejected:${recent.id}`,
    title: `"${recent.title}" was not accepted`,
    detail: recent.rejectionReason
      ? `Reason given: ${recent.rejectionReason}`
      : "You can submit a revised version with updated details.",
    status: "Not accepted",
    href: `/selling/new?fromRejected=${encodeURIComponent(recent.id)}`,
  };
}

/** Each submission a specialist sent back: the seller edits it and sends it again. */
function changesRequestedItems(submissions: readonly ItemSubmission[]): SellerAttentionItem[] {
  return submissions
    .filter((s) => s.status === "changes_requested")
    .map((s) => ({
      id: `changes:${s.id}`,
      title: `"${s.title}" needs changes`,
      detail: s.changesRequestedNote
        ? `Your specialist asked: ${s.changesRequestedNote}`
        : "Your specialist asked for a few changes before deciding.",
      status: "Needs changes",
      href: `${CONSIGNMENTS}/${s.id}`,
    }));
}

function unsoldItem(lots: readonly Lot[]): SellerAttentionItem | null {
  const unsold = lots.filter((lot) => lot.status === "ended" && !lot.winnerId);
  if (unsold.length === 0) return null;
  return {
    id: "unsold",
    title:
      unsold.length === 1
        ? `"${unsold[0]?.title}" did not sell`
        : `${unsold.length} lots did not sell`,
    detail: `${plural(unsold.length, "It", "They")} ended without a winning bid. Review ${plural(unsold.length, "it", "them")} and decide what happens next.`,
    status: "Decide next step",
    href: `${CONSIGNMENTS}?tab=unsold`,
  };
}

/**
 * What a seller should do next, most urgent first, built only from data the overview already
 * loads. A task that applies to many items is one row that leads to the filtered list, so the
 * list stays short however much the seller has consigned.
 */
export function buildSellerAttentionItems(input: Input): SellerAttentionItem[] {
  const items: SellerAttentionItem[] = [
    ...changesRequestedItems(input.submissions),
    ...draftItems(input.submissions),
  ];

  if (input.identityVerificationNeeded) {
    items.push({
      id: "identity",
      title: "Verify your identity",
      detail: "We check who you are before we can pay you.",
      status: "To do",
      href: "/verify-identity",
    });
  }

  const hasWorkAwaitingPayout =
    input.lots.length > 0 ||
    input.submissions.some((s) => s.status === "approved" || s.status === "converted");
  if (input.payoutSetupIncomplete && input.canOpenPayoutSetup && hasWorkAwaitingPayout) {
    items.push({
      id: "payout-setup",
      title: "Finish payout setup",
      detail: "We can only pay you once your bank details are verified.",
      status: "To do",
      href: input.payoutSetupHref,
    });
  }

  const rejected = rejectedItem(input.submissions, input.now);
  if (rejected) items.push(rejected);

  const unsold = unsoldItem(input.lots);
  if (unsold) items.push(unsold);

  return items;
}
