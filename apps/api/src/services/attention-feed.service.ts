import type { Database } from "@auction/db";
import { itemSubmission, lot, payment } from "@auction/db/schema";
import type { ItemSubmissionStatus, PaymentStatus } from "@auction/types";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { AttentionItem, IAttentionFeedReader } from "./interfaces/attention-feed.js";

const STALE_PAYMENT_HOURS = 48;

type SubmissionAttentionRow = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  createdAt: Date;
};

type PaymentAttentionRow = {
  id: string;
  status: PaymentStatus;
  createdAt: Date;
};

type DraftLotAttentionRow = {
  id: string;
  title: string;
  startTime: Date;
  createdAt: Date;
};

export class DrizzleAttentionFeedReader implements IAttentionFeedReader {
  constructor(private readonly db: Database) {}

  async list(limit = 10): Promise<AttentionItem[]> {
    const now = new Date();

    const [submissions, stalePayments, staleDrafts] = await Promise.all([
      this.db
        .select({
          id: itemSubmission.id,
          title: itemSubmission.title,
          status: itemSubmission.status,
          createdAt: itemSubmission.updatedAt,
        })
        .from(itemSubmission)
        .where(inArray(itemSubmission.status, ["submitted", "under_review"]))
        .orderBy(desc(itemSubmission.updatedAt))
        .limit(limit),
      this.db
        .select({
          id: payment.id,
          status: payment.status,
          createdAt: payment.createdAt,
        })
        .from(payment)
        .where(inArray(payment.status, ["pending", "authorized"]))
        .orderBy(desc(payment.createdAt))
        .limit(limit),
      this.db
        .select({
          id: lot.id,
          title: lot.title,
          startTime: lot.startTime,
          createdAt: lot.updatedAt,
        })
        .from(lot)
        .where(and(eq(lot.status, "draft"), lt(lot.startTime, now)))
        .orderBy(desc(lot.updatedAt))
        .limit(limit),
    ]);

    return composeAttentionItems({
      submissions,
      payments: stalePayments,
      draftLots: staleDrafts,
      now,
      limit,
    });
  }
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
        href: `/admin/submissions/${row.id}`,
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
          href: "/admin/payments",
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
          href: `/admin/lots/${row.id}`,
          ctaLabel: "Publish",
          createdAt: row.createdAt,
        }),
      ),
  ];

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, input.limit);
}
