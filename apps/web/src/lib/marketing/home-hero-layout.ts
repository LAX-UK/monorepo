/** Bleed home hero under fixed marketing header */
export const HOME_HERO_BLEED = "-mt-[var(--header-height)]";

/** Full viewport height on all screen sizes to prevent header content overlap. */
export const HOME_HERO_MIN_H =
  "min-h-[calc(100svh+var(--header-height))] supports-[height:100dvh]:min-h-[calc(100dvh+var(--header-height))]";

/** Inner content column — keeps copy below header chrome */
export const HOME_HERO_CONTENT_PT = "pt-[calc(var(--header-height)+2rem)]";
