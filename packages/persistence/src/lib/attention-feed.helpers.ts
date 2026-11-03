import {
  type CapabilityRequirement,
  FINANCE_ACCESS,
  LOTS_READ_ACCESS,
  SUBMISSIONS_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  adminRoutes,
  userHasAccessTo,
} from "@auction/types";
import type {
  AttentionItem,
  AttentionItemKind,
  DraftLotAttentionRow,
  PaymentAttentionRow,
  SubmissionAttentionRow,
} from "../interfaces/attention-feed.reader.js";

const STALE_PAYMENT_HOURS = 48;

/** What a person needs to open the page each kind of attention item links to. */
export const ATTENTION_KIND_ACCESS: Record<AttentionItemKind, CapabilityRequirement> = {
  submission_under_review: SUBMISSIONS_READ_ACCESS,
  payment_stale: FINANCE_ACCESS,
  lot_draft_past_start: LOTS_READ_ACCESS,
};

/** The items this person can open; the feed is built once for everyone and cut down here. */
export function attentionItemsForViewer(
  items: readonly AttentionItem[],
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): AttentionItem[] {
  return items.filter((item) =>
    userHasAccessTo(role, staffRoles, ATTENTION_KIND_ACCESS[item.kind]),
  );
}

export function composeAttentionItems(input: {
  submissions: SubmissionAttentionRow[];
  payments: PaymentAttentionRow[];
  draftLots: DraftLotAttentionRow[];
  now: Date;
  limit: number;
}): AttentionItem[] {
  const staleCutoff = new Date(input.now.getTime() - STALE_PAYMENT_HOURS * 60 * 60_000);
  const items: AttentionItem[] = [
    ...input.submissions.map(
      (row): AttentionItem => ({
        id: `sub-${row.id}`,
        kind: "submission_under_review",
        title: row.title,
        hint: row.status === "submitted" ? "Submitted" : "Under review",
        href: adminRoutes.submission(row.id),
        ctaLabel: "Review",
        createdAt: row.createdAt,
      }),
    ),
    ...input.payments
      .filter((row) => row.createdAt < staleCutoff)
      .map(
        (row): AttentionItem => ({
          id: `pay-${row.id}`,
          kind: "payment_stale",
          title: `Payment ${row.id.slice(0, 8)}…`,
          hint: `${row.status} > ${STALE_PAYMENT_HOURS}h`,
          href: adminRoutes.payments.list(),
          ctaLabel: "Open",
          createdAt: row.createdAt,
        }),
      ),
    ...input.draftLots
      .filter((row) => row.startTime < input.now)
      .map(
        (row): AttentionItem => ({
          id: `draft-${row.id}`,
          kind: "lot_draft_past_start",
          title: row.title,
          hint: "Draft · start in the past",
          href: adminRoutes.lot(row.id),
          ctaLabel: "Publish",
          createdAt: row.createdAt,
        }),
      ),
  ];

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, input.limit);
}
