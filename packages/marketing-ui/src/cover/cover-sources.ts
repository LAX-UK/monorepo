import type { CoverMedia } from "./cover-types.js";

/** The pinned sales shown: at most three (the home page pins no more). */
export const COVER_MAX_SLIDES = 3;

/** A photograph with no scrim for the desktop box cannot carry text, so it is not a source. */
export function isUsableSource(media: CoverMedia): boolean {
  return media.kind === "plate" || Boolean(media.scrim.desktop);
}

/** Index of the first source that is usable and has not failed to load; -1 means type only. */
export function activeCoverMediaIndex(
  media: readonly CoverMedia[],
  failed: ReadonlySet<number>,
): number {
  return media.findIndex((source, i) => isUsableSource(source) && !failed.has(i));
}

/**
 * The picture to show. Null means the cover is type only: no pictures were given, none can
 * carry text, or every one failed to load.
 */
export function activeCoverMedia(
  media: readonly CoverMedia[],
  failed: ReadonlySet<number>,
): CoverMedia | null {
  return media[activeCoverMediaIndex(media, failed)] ?? null;
}

/** Previous and next wrap around, so the pair never dead-ends. */
export function stepSlide(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  return (current + direction + count) % count;
}

/** "1 of 3". */
export function slidePosition(current: number, count: number): string {
  return `${current + 1} of ${count}`;
}
