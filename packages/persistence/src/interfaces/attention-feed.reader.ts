import type { ItemSubmissionStatus, PaymentStatus } from "@auction/types";

export type AttentionItemKind =
  | "submission_under_review"
  | "payment_stale"
  | "lot_draft_past_start";

export type AttentionItem = {
  id: string;
  kind: AttentionItemKind;
  title: string;
  hint: string;
  href: string;
  ctaLabel?: string;
  createdAt: Date;
};

export interface IAttentionFeedReader {
  list(limit?: number): Promise<AttentionItem[]>;
}

export type SubmissionAttentionRow = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  createdAt: Date;
};

export type PaymentAttentionRow = {
  id: string;
  status: PaymentStatus;
  createdAt: Date;
};

export type DraftLotAttentionRow = {
  id: string;
  title: string;
  startTime: Date;
  createdAt: Date;
};
