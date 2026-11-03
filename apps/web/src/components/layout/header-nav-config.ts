import { NAV_LABEL_CLASSES } from "@/components/marketing/nav-label";
import { getMarketingMegaMenuSections } from "@/lib/marketing/mega-menu-catalog";
import {
  NO_NAV_ACTIVITY,
  type NavActivityKey,
  applyNavActivity,
} from "@/lib/marketing/nav-activity";
import { linkIsCurrent } from "@/lib/nav/is-current";

export type MegaMenuItem = {
  href: string;
  label: string;
  /** The item shows only while this list has something in it. */
  requires?: NavActivityKey;
};

export type MegaMenuSection = {
  id: string;
  href: string;
  label: string;
  items: MegaMenuItem[];
  /** Makes the section a plain link in the desktop bar instead of a menu. */
  linkHref?: string;
  viewAllHref?: string;
  /** When set with `viewAllHref`, overrides default “View all …” copy in the mega panel. */
  viewAllLabel?: string;
};

/** The menu before the page has said what is live: only the items that never go empty. */
export function emptyMegaMenuSections(): MegaMenuSection[] {
  return applyNavActivity(getMarketingMegaMenuSections(), NO_NAV_ACTIVITY);
}

export const utilityNav = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  { href: "/faq", label: "FAQ" },
] as const;

/** Primary mega-menu trigger active state. */
export function megaMenuSectionActive(
  pathname: string,
  section: Pick<MegaMenuSection, "id" | "href">,
): boolean {
  if (section.id === "artists") {
    return pathname.startsWith("/artists") || pathname.startsWith("/artist/");
  }
  if (section.id === "sell") {
    return (
      pathname === "/sell" ||
      pathname.startsWith("/sell/") ||
      pathname.startsWith("/selling/consignments") ||
      pathname.startsWith("/selling")
    );
  }
  if (section.id === "auctions") {
    return pathname.startsWith("/sales");
  }
  if (section.id === "results") {
    return pathname.startsWith("/results");
  }
  return navItemActive(pathname, section.href);
}

export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/artists" || href.startsWith("/artists/")) {
    return pathname.startsWith("/artists") || pathname.startsWith("/artist/");
  }
  if (href.startsWith("/sales")) return pathname.startsWith("/sales");
  if (href.startsWith("/search")) return pathname.startsWith("/search");
  if (href.startsWith("/selling")) return pathname.startsWith("/selling");
  if (href.startsWith("/selling/consignments")) return pathname.startsWith("/selling/consignments");
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  return linkIsCurrent(pathname, href);
}

export const linkTop = NAV_LABEL_CLASSES;
