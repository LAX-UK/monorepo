import { DEFAULT_EVENT_SLUG, eventAssetPath, resolveEventSlug } from "./config.js";

function attachImageFallback(img: HTMLImageElement, fallbackSrc: string): void {
  img.addEventListener(
    "error",
    () => {
      if (img.src !== fallbackSrc) img.src = fallbackSrc;
    },
    { once: true },
  );
}

/** Sync static index.html image placeholders with bundled or CDN asset URLs. */
export function applyPageAssets(slug?: string): void {
  const resolvedSlug = slug ?? resolveEventSlug();
  if (!resolvedSlug) return;

  const pageAssets: Record<string, string> = {
    hero: eventAssetPath("hero.jpg", resolvedSlug),
    "highlight-lot": eventAssetPath("highlight-lot.jpg", resolvedSlug),
  };
  const fallbackAssets: Record<string, string> = {
    hero: eventAssetPath("hero.jpg", DEFAULT_EVENT_SLUG),
    "highlight-lot": eventAssetPath("highlight-lot.jpg", DEFAULT_EVENT_SLUG),
  };

  for (const [key, src] of Object.entries(pageAssets)) {
    for (const img of document.querySelectorAll<HTMLImageElement>(
      `img[data-event-asset="${key}"]`,
    )) {
      img.src = src;
      attachImageFallback(img, fallbackAssets[key] ?? src);
    }
  }
}
