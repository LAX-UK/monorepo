/*
 * What a saved view keeps of a list's address. A plain module (no "use client"), so server code can call it: a value exported from
 * a client module is only a client reference on the server.
 */

/** Parameters that say where in a list you are, not what the list shows. */
const PAGING_PARAMS = ["offset", "cursor", "page"];

/** A list's URL params without paging, so a view is the filters and not the page it was saved on. */
export function viewQuery(query: string): string {
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  for (const name of PAGING_PARAMS) params.delete(name);
  return params.toString();
}

/** True when two URL param strings show the same list: same params, any order, any page. */
export function sameViewQuery(a: string, b: string): boolean {
  const canonical = (query: string) =>
    [...new URLSearchParams(viewQuery(query)).entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("&");
  return canonical(a) === canonical(b);
}
