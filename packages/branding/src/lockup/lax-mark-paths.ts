/**
 * The plain LAX mark shared by every product except Bid: the L, a thin two-stroke A with no
 * crossbar, the X, and the light-grey slash across it. Coordinates are in the space of the
 * Bid lockup so the two stay aligned. The L, the X and the slash are the outlines of the Bid
 * lockup master (packages/auth/src/hosted-auth/assets/lax-bid-logo.svg), except that the X
 * drops the foot that exists only to meet the gavel handle, and the X and slash sit 18 units
 * further left, as in the shared raster logo. The A is rebuilt from the Bid A's stroke width,
 * slope, apex and baseline.
 */
export const LAX_MARK_BOUNDS = { x: 0, y: 6.9, width: 586.3, height: 280.9 } as const;

/** The dark strokes of the mark. */
export const LAX_MARK_INK_PATHS: readonly string[] = [
  "M18.17 270.58 L18.17 7.13 L17.08 7.13 L1.09 7.13 L0 7.13 L0 287.67 L1.09 287.67 L118.87 287.67 L119.96 287.67 L126.82 270.58 L125.73 270.58 L18.17 270.58Z",
  "M247.91 6.86L269.59 7.12L382.2 287.67L362.9 287.67L258.75 28.15L154.6 287.67L135.2 287.67Z",
  "M581.28,287.78h-21.34l-87.77-121.82-9.42,13.1-74.36,103.18L392.89,276L382.73,260.5L452.07,164.26l9.42-13.09L357.98,7.5h21.34l92.85,128.86,10.66,14.82,98.45,136.61Z",
];

/** The light-grey slash that crosses the X. */
export const LAX_MARK_MIST_PATHS: readonly string[] = [
  "M493.47 135.92 L586.33 7.04 L565.29 7.04 L482.94 121.29 L485.89 125.39 L493.47 135.92Z",
];
