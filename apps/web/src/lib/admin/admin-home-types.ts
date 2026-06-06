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
  statusTone?: "live" | "neutral" | "warning" | "success";
  priceLabel?: string;
  endsLabel?: string;
};
