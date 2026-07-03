import { ASSETS, EVENT_ORIGIN, eventAssetPath } from "./config.js";
import type { OnsiteEventPublicConfig } from "./rsvp-api.js";

const SITE_NAME = "LAX — London Auction Exchange";
const GENERIC_TITLE = "LAX Event";
const GENERIC_DESCRIPTION =
  "Strictly by invitation. RSVP for an exclusive LAX — London Auction Exchange evening.";

function buildDescription(config?: OnsiteEventPublicConfig): string {
  if (!config?.title) return GENERIC_DESCRIPTION;
  const parts = ["Strictly by invitation.", `RSVP for ${config.title}`];
  if (config.startsAt) {
    const startsAt = new Date(config.startsAt);
    if (!Number.isNaN(startsAt.getTime())) {
      parts.push(
        new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Europe/London",
        }).format(startsAt),
      );
    }
  }
  if (config.venue?.trim()) parts.push(config.venue.trim());
  return `${parts.join(" — ")}.`;
}

function resolveHeroImage(config?: OnsiteEventPublicConfig): string {
  const slug = config?.slug;
  const heroPath = slug ? eventAssetPath("hero.jpg", slug) : ASSETS.hero;
  return new URL(heroPath, EVENT_ORIGIN).toString();
}

const HUB_TITLE = "LAX — Upcoming Events";
const HUB_DESCRIPTION =
  "Strictly by invitation. Browse upcoming LAX — London Auction Exchange onsite and hybrid evenings.";
const HUB_INVITE_TITLE = "Upcoming LAX Events — RSVP";

/** Hub landing SEO for event.lax.bid/ */
export function applyEventHubSeo(): void {
  const pageUrl = new URL(
    window.location.pathname + window.location.search,
    EVENT_ORIGIN,
  ).toString();
  const title = HUB_INVITE_TITLE;
  const description = HUB_DESCRIPTION;
  const image = new URL("/black/lax-primary.svg", EVENT_ORIGIN).toString();

  document.title = title;
  setMeta("name", "description", description);
  setMeta("name", "application-name", HUB_TITLE);
  setLink("canonical", pageUrl);

  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", pageUrl);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:alt", HUB_TITLE);
  setMeta("property", "og:locale", "en_GB");

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
  setMeta("name", "twitter:image:alt", HUB_TITLE);

  const jsonLd = document.getElementById("event-jsonld");
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: HUB_TITLE,
      description,
      url: pageUrl,
    });
  }
}

/** Sync document head with resolved event config (dev/staging friendly). */
export function applyEventSeo(config?: OnsiteEventPublicConfig): void {
  const pageUrl = new URL(
    window.location.pathname + window.location.search,
    EVENT_ORIGIN,
  ).toString();
  const eventTitle = config?.title?.trim() || GENERIC_TITLE;
  const title = `${eventTitle} — You're Invited`;
  const description = buildDescription(config);
  const image = resolveHeroImage(config);
  const imageAlt = `${eventTitle} — invitation hero`;

  document.title = title;

  setMeta("name", "description", description);
  setMeta("name", "application-name", eventTitle);
  setLink("canonical", pageUrl);

  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", pageUrl);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:alt", imageAlt);
  setMeta("property", "og:locale", "en_GB");

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
  setMeta("name", "twitter:image:alt", imageAlt);

  const jsonLd = document.getElementById("event-jsonld");
  if (jsonLd?.textContent) {
    try {
      const data = JSON.parse(jsonLd.textContent) as Record<string, unknown>;
      data.name = eventTitle;
      data.description = description;
      data.url = pageUrl;
      data.image = image;
      if (config?.startsAt) {
        data.startDate = config.startsAt;
      }
      if (config?.venue?.trim()) {
        data.location = {
          "@type": "Place",
          name: config.venue.trim(),
          address: {
            "@type": "PostalAddress",
            addressLocality: "London",
            addressCountry: "GB",
          },
        };
      }
      jsonLd.textContent = JSON.stringify(data);
    } catch {
      /* keep static fallback */
    }
  }
}

function setMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string): void {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.append(el);
  }
  el.href = href;
}
