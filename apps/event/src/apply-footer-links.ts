import { EVENTS_EMAIL, SOCIAL_LINKS, WEB_ORIGIN } from "./config.js";

/** Wire footer social + site links from build-time config. */
export function applyFooterLinks(opsEmail?: string | null): void {
  for (const [key, href] of Object.entries(SOCIAL_LINKS)) {
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>(`a[data-social="${key}"]`)) {
      anchor.href = href;
    }
  }

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[data-footer-site]")) {
    anchor.href = WEB_ORIGIN;
    anchor.textContent = new URL(WEB_ORIGIN).host;
  }

  const email = opsEmail?.trim() || EVENTS_EMAIL;
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[data-events-email]")) {
    anchor.href = `mailto:${email}`;
    anchor.textContent = email;
  }
}
