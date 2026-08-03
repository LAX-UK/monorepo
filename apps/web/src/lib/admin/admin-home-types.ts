export type AttentionDomain = "Finance" | "Compliance" | "People" | "Catalog" | "Operations";

export type AdminAttentionKind =
  | "submission_under_review"
  | "payment_stale"
  | "lot_draft_past_start";

/** Shared row shapes for admin home / personal dashboard widgets. */
export type AdminAttentionRow = {
  id: string;
  title: string;
  hint: string;
  href: string;
  ctaLabel: string;
  /** Optional domain for My Queue grouping; inferred from id/href when omitted. */
  domain?: AttentionDomain;
  /** Authoritative source timestamp when provided by API/read models. */
  sourceUpdatedAt?: string | null;
  /** Attention feed kind — used for SLA enrichment only when authoritative. */
  attentionKind?: AdminAttentionKind;
};

export type AdminActivityRow = {
  id: string;
  title: string;
  meta: string;
  href: string;
  statusLabel?: string;
  /** When set, `ended` lots resolve to Sold vs Unsold in status chips. */
  winnerId?: string | null;
  priceLabel?: string;
  endsLabel?: string;
};
