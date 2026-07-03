import { CATALOGUE_URL, DEFAULT_EVENT_SLUG, WEB_ORIGIN } from "./config.js";
import type { OnsiteEventPublicConfig } from "./rsvp-api.js";
import { slugifyTitle } from "./sale-catalog-api.js";

export function resolveEventTemplate(slug: string): "lax001" | "generic" {
  return slug === DEFAULT_EVENT_SLUG ? "lax001" : "generic";
}

export function buildLinkedSaleCatalogUrl(
  saleId: string | null,
  saleTitle: string | null,
): string | null {
  if (!saleId || !saleTitle) return null;
  return `${WEB_ORIGIN}/sales/${slugifyTitle(saleTitle)}/${saleId}`;
}

export function applyEventContent(config: OnsiteEventPublicConfig): void {
  const template = resolveEventTemplate(config.slug);
  document.documentElement.dataset.eventTemplate = template;

  for (const node of document.querySelectorAll<HTMLElement>("[data-event-section]")) {
    const section = node.getAttribute("data-event-section");
    node.hidden = section !== template && section !== "shared";
  }

  applyText("[data-event-title]", config.title);

  if (config.venue) {
    applyText("[data-event-venue]", config.venue);
  }
  if (config.dressCode) {
    applyText("[data-event-dress-code]", config.dressCode);
  }
  if (config.arrivalNote) {
    applyText("[data-event-arrival-note]", config.arrivalNote);
    for (const node of document.querySelectorAll<HTMLElement>("[data-event-arrival-note]")) {
      node.hidden = false;
      const row = node.closest<HTMLElement>("tr[data-event-section]");
      if (row) row.hidden = false;
    }
  }

  const heroImg = document.querySelector<HTMLImageElement>('img[data-event-asset="hero"]');
  if (heroImg) {
    heroImg.alt = config.title;
  }

  const catalogUrl =
    buildLinkedSaleCatalogUrl(config.saleId, config.linkedSaleTitle) ?? CATALOGUE_URL;
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("[data-catalogue-link]")) {
    anchor.href = catalogUrl;
    if (config.linkedSaleTitle && config.saleId) {
      anchor.textContent = `Browse ${config.linkedSaleTitle} on lax.bid`;
    }
  }

  for (const node of document.querySelectorAll<HTMLElement>("[data-event-footer-tagline]")) {
    node.textContent = `Strictly by invitation • ${config.title}`;
  }
}

function applyText(selector: string, text: string): void {
  for (const node of document.querySelectorAll<HTMLElement>(selector)) {
    node.textContent = text;
  }
}
