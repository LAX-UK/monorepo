import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { LotStatus } from "@auction/types";

export type BuildSearchQsOpts = {
  offset: number;
  q: string;
  sort: string;
  categoryId?: string;
  view: CatalogLayoutView;
  status?: LotStatus;
  ending?: SearchEndingWindow;
};

/** Build the URLSearchParams string for /search page links. */
export function buildSearchQs(opts: BuildSearchQsOpts): string {
  const p = new URLSearchParams();
  p.set("offset", String(opts.offset));
  if (opts.q.trim()) p.set("q", opts.q.trim());
  if (opts.sort !== "endingAsc") p.set("sort", opts.sort);
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  if (opts.status) p.set("status", opts.status);
  if (opts.ending) p.set("ending", opts.ending);
  p.set("view", opts.view);
  return p.toString();
}
