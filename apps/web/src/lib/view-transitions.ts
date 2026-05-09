/**
 * F5a — View Transitions API helpers.
 *
 * Sites that opt in: a lot card image and the lot detail hero image share the
 * same `view-transition-name` so Chromium-based browsers smoothly morph from
 * the card to the detail page. Browsers without support fall back to instant
 * navigation — the API is a progressive enhancement.
 */

const SAFE_PREFIX = "lot-image-";

/** Generate a stable, CSS-safe transition name for a lot's image. */
export function lotImageTransitionName(lotId: string): string {
  return `${SAFE_PREFIX}${lotId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Inline style to apply on both the card image and the detail hero image. */
export function lotImageTransitionStyle(lotId: string): { viewTransitionName: string } {
  return { viewTransitionName: lotImageTransitionName(lotId) };
}
