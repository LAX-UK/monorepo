/** Bleed home hero under fixed marketing header */
export const HOME_HERO_BLEED = "-mt-[var(--header-height)]";

/** Mobile/tablet: full viewport. lg+: capped band reduces horizontal crop on wide masters. */
export const HOME_HERO_MIN_H =
  "min-h-[calc(100svh+var(--header-height))] supports-[height:100dvh]:min-h-[calc(100dvh+var(--header-height))] lg:min-h-[clamp(520px,60vh,720px)] lg:supports-[height:100dvh]:min-h-[clamp(520px,60dvh,720px)]";

/** Inner content column — keeps copy below header chrome */
export const HOME_HERO_CONTENT_PT = "pt-[calc(var(--header-height)+2rem)]";
