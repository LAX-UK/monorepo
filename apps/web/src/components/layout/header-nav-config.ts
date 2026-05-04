import { linkIsCurrent } from "@/lib/nav/is-current";

export const primaryNav = [
  { href: "/", label: "Upcoming Auctions" },
  { href: "/archive", label: "Past Auctions" },
  { href: "/artist/featured", label: "Artists" },
] as const;

export type MegaMenuItem = { href: string; label: string };

export type MegaMenuSection = {
  href: string;
  label: string;
  items: MegaMenuItem[];
  viewAllHref?: string;
};

/** Empty items; marketing layout fills from server data. */
export function emptyMegaMenuSections(): MegaMenuSection[] {
  return primaryNav.map((item) => ({
    href: item.href,
    label: item.label,
    items: [],
    viewAllHref: item.href,
  }));
}

export const utilityNav = [
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact us" },
  { href: "/about", label: "About us" },
] as const;

export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/artist/featured") return pathname.startsWith("/artist");
  return linkIsCurrent(pathname, href);
}

export const linkTop =
  "font-label text-sm font-medium uppercase leading-[21px] text-nav-text transition-colors hover:text-brand-900";
