import type { CatalogLot } from "./catalog-lot.js";
import { ASSETS, WEB_ORIGIN } from "./config.js";
import { MODEL_T_TITLE } from "./sale-catalog-api.js";

/** Headline lot — always first in the carousel. */
export function modelTHighlight(href?: string | null): CatalogLot {
  return {
    title: MODEL_T_TITLE,
    category: "Automobilia",
    estimate: "£15,000 – £25,000",
    openingBid: "£1",
    image: ASSETS.highlightLot,
    href: href ?? `${WEB_ORIGIN}/sales?deliveryMode=onsite`,
    featured: true,
  };
}

export function buildCarouselLots(
  catalogLots: CatalogLot[],
  modelTHref?: string | null,
): CatalogLot[] {
  return [modelTHighlight(modelTHref), ...catalogLots];
}
