export type ResultsView = "sales" | "lots";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

/** `?view=lots` opens the sold-works search; anything else is the list of sales. */
export function parseResultsView(searchParams: SearchParams): ResultsView {
  return first(searchParams.view) === "lots" ? "lots" : "sales";
}

/** One-based page number from `?page=`, defaulting to the first page. */
export function parseResultsPage(searchParams: SearchParams): number {
  const n = Number.parseInt(first(searchParams.page) ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function resultsHref(view: ResultsView, page = 1): string {
  const params = new URLSearchParams();
  if (view === "lots") params.set("view", "lots");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/results?${qs}` : "/results";
}
