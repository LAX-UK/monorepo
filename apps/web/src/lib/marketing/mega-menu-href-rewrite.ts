import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { isClientAreaPath } from "@/lib/navigation/client-routes";

/** Rewrites dashboard routes to login-with-next for logged-out mega menu users. */
export function rewriteDashboardHrefForGuest(href: string): string {
  if (!isClientAreaPath(href.split(/[?#]/)[0] ?? href)) return href;
  return `/login?next=${encodeURIComponent(href)}`;
}

/** Restores dashboard hrefs from guest login redirects when the viewer is authenticated. */
export function restoreDashboardHrefForAuthed(href: string): string {
  if (!href.startsWith("/login?")) return href;
  try {
    const next = new URL(href, "http://local").searchParams.get("next");
    if (next && isClientAreaPath(next.split(/[?#]/)[0] ?? next)) return next;
  } catch {
    // ignore malformed href
  }
  return href;
}

export function rewriteMegaMenuForGuest(sections: MegaMenuSection[]): MegaMenuSection[] {
  return sections.map((section) => ({
    ...section,
    href: rewriteDashboardHrefForGuest(section.href),
    items: section.items.map((item) => ({
      ...item,
      href: rewriteDashboardHrefForGuest(item.href),
    })),
  }));
}

export function restoreMegaMenuAuthedHrefs(sections: MegaMenuSection[]): MegaMenuSection[] {
  return sections.map((section) => ({
    ...section,
    href: restoreDashboardHrefForAuthed(section.href),
    items: section.items.map((item) => ({
      ...item,
      href: restoreDashboardHrefForAuthed(item.href),
    })),
  }));
}
