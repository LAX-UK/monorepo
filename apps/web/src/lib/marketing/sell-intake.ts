type SellIntakeOptions = {
  /** Pre-select category in wizard basics step (matches DB category slug). */
  categorySlug?: string;
};

/** Auth handoff URLs for the structured consignment submission wizard. */
export function sellIntakeHref(opts?: SellIntakeOptions): string {
  const next = opts?.categorySlug
    ? `/dashboard/submissions/new?categorySlug=${encodeURIComponent(opts.categorySlug)}`
    : "/dashboard/submissions/new";
  return `/login?next=${encodeURIComponent(next)}&intent=sell`;
}

export function sellRegisterHref(opts?: SellIntakeOptions): string {
  const next = opts?.categorySlug
    ? `/dashboard/submissions/new?categorySlug=${encodeURIComponent(opts.categorySlug)}`
    : "/dashboard/submissions/new";
  return `/register?next=${encodeURIComponent(next)}&intent=sell`;
}

export function sellContactHref(type?: "prints" | "corporate" | "estate" | "jewellery"): string {
  const params = new URLSearchParams({ intent: "selling" });
  if (type) params.set("type", type);
  return `/contact?${params.toString()}`;
}
