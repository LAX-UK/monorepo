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
