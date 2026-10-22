/**
 * Returns the nav href that owns `pathname`: the longest href equal to it or one of its parents,
 * so `/orders/123` highlights "Orders" and `/orders-archive` does not. Query strings and
 * trailing slashes are ignored. Returns null when no item owns the path.
 */
export function resolveActiveNavHref(pathname: string, hrefs: readonly string[]): string | null {
  const path = normalise(pathname);
  let best: string | null = null;
  for (const href of hrefs) {
    const candidate = normalise(href);
    const owns = path === candidate || path.startsWith(`${candidate}/`);
    if (owns && (best === null || candidate.length > normalise(best).length)) {
      best = href;
    }
  }
  return best;
}

function normalise(value: string): string {
  const withoutQuery = value.split(/[?#]/)[0] ?? "";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}
