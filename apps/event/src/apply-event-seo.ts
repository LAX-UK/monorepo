import { ASSETS, EVENT_DETAILS, EVENT_ORIGIN } from "./config.js";

const SITE_NAME = "LAX — London Auction Exchange";
const DEFAULT_DESCRIPTION =
  "Strictly by invitation. RSVP for LAX 001: The First Hammer — Thursday 18 June 2026, Brunswick Art Gallery, London. Opening bids from £1.";

/** Sync document head with build-time origins (dev/staging friendly). */
export function applyEventSeo(): void {
  const pageUrl = new URL(
    window.location.pathname + window.location.search,
    EVENT_ORIGIN,
  ).toString();
  const title = `${EVENT_DETAILS.title} — You're Invited`;
  const image = new URL(ASSETS.hero, EVENT_ORIGIN).toString();

  document.title = title;

  setMeta("name", "description", DEFAULT_DESCRIPTION);
  setLink("canonical", pageUrl);

  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", DEFAULT_DESCRIPTION);
  setMeta("property", "og:url", pageUrl);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:alt", `${EVENT_DETAILS.title} — invitation hero`);
  setMeta("property", "og:locale", "en_GB");

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", DEFAULT_DESCRIPTION);
  setMeta("name", "twitter:image", image);
  setMeta("name", "twitter:image:alt", `${EVENT_DETAILS.title} — invitation hero`);

  const jsonLd = document.getElementById("event-jsonld");
  if (jsonLd?.textContent) {
    try {
      const data = JSON.parse(jsonLd.textContent) as Record<string, unknown>;
      data.url = pageUrl;
      data.image = image;
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
