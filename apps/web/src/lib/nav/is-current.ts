/** Shared rule for footer / utility nav "current page" highlighting. */
export function linkIsCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.endsWith(".xml")) {
    return pathname === href || pathname.endsWith(href.replace(/^\//, ""));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
