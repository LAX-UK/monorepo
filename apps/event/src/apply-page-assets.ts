import { ASSETS } from "./config.js";

const PAGE_ASSETS: Record<string, string> = {
  hero: ASSETS.hero,
  "highlight-lot": ASSETS.highlightLot,
};

/** Sync static index.html image placeholders with bundled or CDN asset URLs. */
export function applyPageAssets(): void {
  for (const [key, src] of Object.entries(PAGE_ASSETS)) {
    for (const img of document.querySelectorAll<HTMLImageElement>(
      `img[data-event-asset="${key}"]`,
    )) {
      img.src = src;
    }
  }
}
