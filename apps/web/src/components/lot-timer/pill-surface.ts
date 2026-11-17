/**
 * The lot pill, in one place: its shape and its two theme surfaces. The timer pill
 * ({@link LotTimerPill}) and the saleroom label pill ("Up next", "In saleroom", "Sold") both read
 * these, so a pill on a card or a row never drifts from the others (or onto a colour token that
 * does not exist). Over imagery inside an adaptive media frame, pills use `overlayPillClasses`
 * instead of a theme surface.
 */
export const PILL_SHELL =
  "items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-xs font-medium backdrop-blur-sm";

/** Solid surface for a pill that needs attention: live, opening soon, up next. */
export const PILL_SURFACE_LIVE =
  "border-transparent bg-brand-900/85 text-white dark:border-transparent dark:bg-black/80 dark:text-white";

/** Quieter surface for a pill that reports a state: closed, in saleroom, sold, paused. */
export const PILL_SURFACE_MUTED =
  "border-transparent bg-brand-900/70 text-white/70 dark:border-transparent dark:bg-black/70 dark:text-white/70";
