export const DEFAULT_EVENT_SLUG = "lax001";

/** Resolve event slug from URL path (`/events/:slug`, `/:slug`) or build-time override. Returns null at bare root for the events hub. */
export function resolveEventSlug(): string | null {
  const envSlug = import.meta.env.VITE_EVENT_SLUG as string | undefined;
  if (typeof window === "undefined") {
    return envSlug ?? null;
  }
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "events" && parts[1]) return parts[1];
  if (parts[0] && parts[0] !== "pass") {
    const passIdx = parts.indexOf("pass");
    if (passIdx > 0) return parts[0] ?? null;
    if (passIdx === -1) return parts[0] ?? null;
  }
  return envSlug ?? null;
}

/** @deprecated Prefer {@link resolveEventSlug} for multi-event routing. */
export const EVENT_SLUG = DEFAULT_EVENT_SLUG;

const cdnBase =
  (import.meta.env.VITE_CDN_BASE as string | undefined)?.replace(/\/$/, "") ??
  "https://cdn.lax.bid";
function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    // Same-origin Vite proxy — direct :3001 calls fail browser CORS preflight from :3003.
    if (!configured || /^https?:\/\/(localhost|127\.0\.0\.1):3001$/.test(configured)) {
      return "";
    }
    return configured;
  }
  return configured ?? "https://api.lax.bid";
}

const apiBase = resolveApiBase();
const webOrigin =
  (import.meta.env.VITE_WEB_ORIGIN as string | undefined)?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://localhost:3000" : "https://lax.bid");
const eventOrigin =
  (import.meta.env.VITE_EVENT_ORIGIN as string | undefined)?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://localhost:3003" : "https://event.lax.bid");

export const CDN_BASE = cdnBase;
export const API_BASE = apiBase;
export const WEB_ORIGIN = webOrigin;
export const EVENT_ORIGIN = eventOrigin;
export const EVENTS_EMAIL = "events@lax.bid";
export const MAPS_URL = "https://maps.app.goo.gl/dYYx2hUYBzgtEVZ18";

/** Bundled under public/events/{slug}; CDN used when VITE_EVENT_ASSETS_CDN=true at build time. */
export function eventAssetPath(
  filename: string,
  slug = resolveEventSlug() ?? DEFAULT_EVENT_SLUG,
): string {
  if (import.meta.env.VITE_EVENT_ASSETS_CDN === "true") {
    return `${CDN_BASE}/events/${slug}/${filename}`;
  }
  return `/events/${slug}/${filename}`;
}

/** Static SVG brand marks in public/black and public/white. */
export const BRAND = {
  laxPrimary: "/black/lax-primary.svg",
  laxPrimaryWhite: "/white/lax-primary.svg",
  laxWordmark: "/black/lax-wordmark.svg",
  laxWordmarkWhite: "/white/lax-wordmark.svg",
  londonStamp: "/black/london-stamp.svg",
  londonStampWhite: "/white/london-stamp.svg",
  laxStylized: "/black/lax-stylized.svg",
  laxStylizedWhite: "/white/lax-stylized.svg",
} as const;

export const ASSETS = {
  hero: eventAssetPath("hero.jpg"),
  highlightLot: eventAssetPath("highlight-lot.jpg"),
} as const;

export const EVENT_DETAILS = {
  title: "LAX 001: The First Hammer",
  date: "Thursday 18 June 2026",
  time: "Doors 6:00 PM",
  venue: "Brunswick Art Gallery & Centre, London",
  dressCode: "Smart Formal",
} as const;

/** Doors open — Europe/London, used for countdown. */
export const EVENT_START_AT = new Date("2026-06-18T17:00:00.000Z");

export function registerUrlForEmail(email: string): string {
  const returnTo = new URL(`${EVENT_ORIGIN}/`);
  returnTo.searchParams.set("email", email);
  returnTo.hash = "rsvp";
  const params = new URLSearchParams({
    next: returnTo.toString(),
    email,
  });
  return `${WEB_ORIGIN}/register?${params.toString()}`;
}

export function parseEmailFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get("email")?.trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

export function clearEmailFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("email")) return;
  url.searchParams.delete("email");
  window.history.replaceState({}, "", url.toString());
}

export const CATALOGUE_URL = `${WEB_ORIGIN}/sales?deliveryMode=onsite`;

/** Canonical social profiles — keep in sync with apps/web footer-socials.tsx */
export const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@londonauctionxchange",
  instagram: "https://www.instagram.com/lax.bid",
  linkedin: "https://www.linkedin.com/company/london-auction-xchange/",
} as const;
