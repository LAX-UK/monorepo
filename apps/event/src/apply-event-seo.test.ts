// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { applyEventHubSeo, applyEventSeo } from "./apply-event-seo.js";
import type { OnsiteEventPublicConfig } from "./rsvp-api.js";

const sampleConfig: OnsiteEventPublicConfig = {
  slug: "lax002",
  title: "LAX 002: Summer Evening",
  segmentOptions: [{ value: "full_evening", label: "Full evening" }],
  rsvpOpen: true,
  rsvpCloseAt: "2099-01-01T00:00:00.000Z",
  micrositeUrl: "https://event.lax.bid/lax002",
  startsAt: "2026-08-14T17:00:00.000Z",
  venue: "Royal Academy, London",
  dressCode: "Smart formal",
  arrivalNote: null,
  opsEmail: "events@lax.bid",
  saleId: null,
  linkedSaleTitle: null,
  status: "published",
};

describe("applyEventSeo", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="">
      <meta property="og:title" content="">
      <meta property="og:description" content="">
      <meta property="og:image" content="">
      <link rel="canonical" href="">
      <script type="application/ld+json" id="event-jsonld">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Event",
        name: "LAX Event",
        description: "Generic",
        url: "https://event.lax.bid/",
        image: "https://event.lax.bid/events/lax001/hero.jpg",
      })}</script>
    `;
    Object.defineProperty(window, "location", {
      value: { pathname: "/lax002", search: "" },
      writable: true,
    });
  });

  it("uses generic defaults when config is omitted", () => {
    applyEventSeo();
    expect(document.title).toBe("LAX Event — You're Invited");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain(
      "Strictly by invitation",
    );
  });

  it("patches title, description, and image from resolved config", () => {
    applyEventSeo(sampleConfig);
    expect(document.title).toBe("LAX 002: Summer Evening — You're Invited");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "LAX 002: Summer Evening — You're Invited",
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toContain(
      "/events/lax002/hero.jpg",
    );
    const jsonLd = JSON.parse(
      document.getElementById("event-jsonld")?.textContent ?? "{}",
    ) as Record<string, unknown>;
    expect(jsonLd.name).toBe("LAX 002: Summer Evening");
    expect(jsonLd.startDate).toBe(sampleConfig.startsAt);
  });

  it("uses hub defaults for the events landing page", () => {
    applyEventHubSeo();
    expect(document.title).toBe("Upcoming LAX Events — RSVP");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain(
      "Browse upcoming LAX",
    );
    const jsonLd = JSON.parse(
      document.getElementById("event-jsonld")?.textContent ?? "{}",
    ) as Record<string, unknown>;
    expect(jsonLd["@type"]).toBe("WebPage");
  });
});
