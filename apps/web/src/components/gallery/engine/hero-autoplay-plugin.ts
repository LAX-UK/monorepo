import Autoplay from "embla-carousel-autoplay";

const AUTO_MS = 11_000;

/** Autoplay plugin factory for the marketing home hero (engine boundary). */
export function createHeroAutoplayPlugin(reduceMotion: boolean, delayMs: number = AUTO_MS) {
  if (reduceMotion) return undefined;
  return [Autoplay({ delay: delayMs, stopOnInteraction: true, stopOnMouseEnter: true })];
}

export const HERO_AUTOPLAY_MS = AUTO_MS;
