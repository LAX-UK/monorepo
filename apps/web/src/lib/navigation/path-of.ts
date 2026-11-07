/** The path of an href: everything before a query or fragment. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0] ?? "";
}
