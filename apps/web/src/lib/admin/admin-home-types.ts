export type AttentionDomain = "Finance" | "Compliance" | "People" | "Catalog" | "Operations";

/** Shared row shapes for admin home / personal dashboard widgets. */
export type AdminAttentionRow = {
  id: string;
  title: string;
  hint: string;
  href: string;
  ctaLabel: string;
  /** Optional domain for My Queue grouping; inferred from id/href when omitted. */
  domain?: AttentionDomain;
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
