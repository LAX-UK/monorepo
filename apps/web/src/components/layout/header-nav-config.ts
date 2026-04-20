export const primaryNav = [
  { href: "/", label: "Upcoming Auctions" },
  { href: "/archive", label: "Past Auctions" },
  { href: "/artist/featured", label: "Artists" },
] as const;

export const utilityNav = [
  { href: "/terms", label: "FAQs" },
  { href: "/contact", label: "Contact us" },
  { href: "/about", label: "About us" },
] as const;

export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/artist/featured") return pathname.startsWith("/artist");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const linkTop =
  "font-label text-sm font-medium uppercase leading-[21px] text-nav-text transition-colors hover:text-brand-900";
