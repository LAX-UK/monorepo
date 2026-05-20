/** Shared row shapes for admin home / personal dashboard widgets. */
export type AdminAttentionRow = {
  id: string;
  title: string;
  hint: string;
  href: string;
  ctaLabel: string;
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
