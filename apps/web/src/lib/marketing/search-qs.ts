import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export type BuildSearchQsOpts = {
  offset: number;
  q: string;
  sort: string;
  categoryId?: string;
  view: CatalogLayoutView;
};

/** Build the URLSearchParams string for /search page links. */
export function buildSearchQs(opts: BuildSearchQsOpts): string {
  const p = new URLSearchParams();
  p.set("offset", String(opts.offset));
  if (opts.q.trim()) p.set("q", opts.q.trim());
  if (opts.sort !== "endingAsc") p.set("sort", opts.sort);
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  p.set("view", opts.view);
  return p.toString();
}
