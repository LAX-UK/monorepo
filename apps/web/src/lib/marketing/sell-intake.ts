type SellIntakeOptions = {
  /** Pre-select category in wizard basics step (matches DB category slug). */
  categorySlug?: string;
};

/** Direct submission wizard path — used by sell CTAs for all users. */
export function sellSubmissionPath(opts?: SellIntakeOptions): string {
  return opts?.categorySlug
    ? `/dashboard/submissions/new?categorySlug=${encodeURIComponent(opts.categorySlug)}`
    : "/dashboard/submissions/new";
}

/** Sell CTA href — goes straight to the wizard when signed in; dashboard guard sends guests to login. */
export function sellIntakeHref(opts?: SellIntakeOptions): string {
  return sellSubmissionPath(opts);
}

export function sellRegisterHref(opts?: SellIntakeOptions): string {
  const next = sellSubmissionPath(opts);
  return `/register?next=${encodeURIComponent(next)}&intent=sell`;
}

export function sellContactHref(type?: "prints" | "corporate" | "estate" | "jewellery"): string {
  const params = new URLSearchParams({ intent: "selling" });
  if (type) params.set("type", type);
  return `/contact?${params.toString()}`;
}

/** Register handoff preserving category preselect from a submission wizard `next` URL. */
export function sellRegisterHrefFromSubmissionNext(next: string): string {
  if (!next.startsWith("/dashboard/submissions")) {
    return sellRegisterHref();
  }
  const query = next.includes("?") ? (next.split("?")[1] ?? "") : "";
  const categorySlug = new URLSearchParams(query).get("categorySlug") ?? undefined;
  return sellRegisterHref(categorySlug ? { categorySlug } : undefined);
}
