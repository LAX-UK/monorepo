import type { ItemSubmission } from "@auction/types";

export type SellerNextAction = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

function mostRecentlyUpdated(rows: ItemSubmission[]): ItemSubmission | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

/** Highest-priority seller task for the dashboard next-action card. */
export function resolveSellerNextAction(input: {
  submissions: ItemSubmission[];
  connectRequired: boolean;
}): SellerNextAction | null {
  const { submissions, connectRequired } = input;

  const draft = mostRecentlyUpdated(submissions.filter((s) => s.status === "draft"));
  if (draft) {
    return {
      title: "Finish your submission",
      description: `"${draft.title}" is saved — complete and submit for specialist review.`,
      href: `/dashboard/submissions/${draft.id}`,
      cta: "Resume submission",
    };
  }

  if (
    connectRequired &&
    submissions.some((s) => s.status === "approved" || s.status === "converted")
  ) {
    return {
      title: "Complete payout setup",
      description:
        "Stripe Connect is required before your accepted items can be scheduled for sale.",
      href: "/dashboard/seller/connect",
      cta: "Set up payouts",
    };
  }

  const rejected = mostRecentlyUpdated(submissions.filter((s) => s.status === "rejected"));
  if (rejected) {
    return {
      title: "Submit a revised item",
      description: rejected.rejectionReason
        ? `Your previous submission was not accepted: ${rejected.rejectionReason}`
        : "Start a new submission with updated information.",
      href: `/dashboard/submissions/new?fromRejected=${encodeURIComponent(rejected.id)}`,
      cta: "Start new submission",
    };
  }

  const approved = mostRecentlyUpdated(submissions.filter((s) => s.status === "approved"));
  if (approved) {
    return {
      title: "Submission accepted",
      description:
        "Our specialists are preparing your catalogue entry. Review remaining seller steps.",
      href: `/dashboard/submissions/${approved.id}`,
      cta: "View next steps",
    };
  }

  const converted = mostRecentlyUpdated(submissions.filter((s) => s.status === "converted"));
  if (converted) {
    return {
      title: "Catalogue preparation in progress",
      description: `"${converted.title}" was converted to a draft lot. See what is left before listing.`,
      href: `/dashboard/submissions/${converted.id}`,
      cta: "View checklist",
    };
  }

  const inReview = mostRecentlyUpdated(
    submissions.filter((s) => s.status === "submitted" || s.status === "under_review"),
  );
  if (inReview) {
    return {
      title: "Under specialist review",
      description: `"${inReview.title}" is with our team. We aim to respond within 24 hours.`,
      href: `/dashboard/submissions/${inReview.id}`,
      cta: "View status",
    };
  }

  return null;
}
