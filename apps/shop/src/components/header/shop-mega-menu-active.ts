import type { ShopMegaMenuSection } from "@/components/header/header-nav.config";

function pathMatches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a mega-menu trigger should show as the current section. */
export function shopMegaMenuSectionActive(
  pathname: string,
  section: Pick<ShopMegaMenuSection, "href" | "items">,
): boolean {
  if (pathMatches(pathname, section.href)) return true;
  return section.items.some((item) => pathMatches(pathname, item.href));
}
