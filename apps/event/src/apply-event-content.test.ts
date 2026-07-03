// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  applyEventContent,
  buildLinkedSaleCatalogUrl,
  resolveEventTemplate,
} from "./apply-event-content.js";
import type { OnsiteEventPublicConfig } from "./rsvp-api.js";

const baseConfig: OnsiteEventPublicConfig = {
  slug: "lax002",
  title: "LAX 002: Summer Evening",
  segmentOptions: [],
  rsvpOpen: true,
  rsvpCloseAt: null,
  micrositeUrl: null,
  startsAt: null,
  venue: "Royal Academy, London",
  dressCode: "Smart formal",
  arrivalNote: "Doors close at 7 PM.",
  opsEmail: "summer@lax.bid",
  saleId: "sale-1",
  linkedSaleTitle: "Summer Sale",
  status: "published",
};

describe("applyEventContent", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-event-section="lax001">LAX001 block</div>
      <div data-event-section="generic" hidden>Generic block</div>
      <div data-event-section="shared">Shared block</div>
      <span data-event-title></span>
      <span data-event-venue></span>
      <span data-event-dress-code></span>
      <p data-event-arrival-note></p>
      <a data-catalogue-link href="#">Catalogue</a>
      <span data-event-footer-tagline></span>
    `;
  });

  it("resolveEventTemplate maps lax001 slug to branded template", () => {
    expect(resolveEventTemplate("lax001")).toBe("lax001");
    expect(resolveEventTemplate("lax002")).toBe("generic");
  });

  it("buildLinkedSaleCatalogUrl returns sale detail path when linked", () => {
    expect(buildLinkedSaleCatalogUrl("sale-1", "Summer Sale")).toMatch(
      /\/sales\/summer-sale\/sale-1$/,
    );
    expect(buildLinkedSaleCatalogUrl(null, "Summer Sale")).toBeNull();
  });

  it("shows generic sections and patches copy from config", () => {
    applyEventContent(baseConfig);
    expect(document.documentElement.dataset.eventTemplate).toBe("generic");
    expect(document.querySelector<HTMLElement>('[data-event-section="lax001"]')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-event-section="generic"]')?.hidden).toBe(
      false,
    );
    expect(document.querySelector<HTMLElement>('[data-event-section="shared"]')?.hidden).toBe(
      false,
    );
    expect(document.querySelector("[data-event-title]")?.textContent).toBe(baseConfig.title);
    expect(document.querySelector("[data-event-venue]")?.textContent).toBe(baseConfig.venue);
    expect(document.querySelector("[data-catalogue-link]")?.textContent).toContain("Summer Sale");
  });
});
