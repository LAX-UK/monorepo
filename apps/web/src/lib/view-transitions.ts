/**
 * Lot image view transitions — list tile morphs into detail hero when the user
 * clicks through. Only the clicked tile gets a `view-transition-name` (see
 * `LotViewTransitionLink`); the detail hero applies the same name on arrival.
 */

export const LOT_TRANSITION_ROOT_ATTR = "data-lot-transition-root";

/** Image surface inside a root — receives the transition name on click. */
export const LOT_TRANSITION_IMAGE_ATTR = "data-lot-transition-image";

const SAFE_PREFIX = "lot-image-";

/** Stable, CSS-safe transition name for a lot's primary image. */
export function lotImageTransitionName(lotId: string): string {
  const safeId = lotId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${SAFE_PREFIX}${safeId}`;
}

export function lotImageTransitionStyle(lotId: string): { viewTransitionName: string } {
  return { viewTransitionName: lotImageTransitionName(lotId) };
}
