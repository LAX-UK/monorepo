/**
 * The LAX system scales, as data. `public/lax-system.css` is what the browser reads; this module
 * names the same steps and their roles for code that reasons about them (tests, docs, the kits'
 * own token modules). `tests/lax-system.test.ts` keeps the two in step.
 */

/** Corner radius in px, one role per step, as `--lax-radius-<role>`. */
export const LAX_RADIUS = {
  badge: { px: 4, use: "Badges, checkboxes, kbd" },
  control: { px: 6, use: "Buttons, fields, selects, nav items, menu items" },
  menu: { px: 8, use: "Menus, popovers, toasts" },
  card: { px: 12, use: "Cards and dialogs" },
} as const;

/** Control heights in px, as `--lax-control-<step>`. */
export const LAX_CONTROL_HEIGHT = {
  sm: { px: 32, use: "Compact: staff toolbars, filters and table actions" },
  md: { px: 36, use: "Default: forms, page actions, client controls on desktop" },
  lg: { px: 44, use: "Touch: client controls on phones and touch screens" },
} as const;

/**
 * Type sizes and line heights in px, as `--lax-text-<size>` and `--lax-text-<size>--line`.
 * 14px also has a paragraph line height (`--lax-text-14--paragraph`).
 */
export const LAX_TYPE_SCALE = {
  12: { lineHeight: 16 },
  13: { lineHeight: 20 },
  14: { lineHeight: 20, paragraph: 24 },
  16: { lineHeight: 24 },
  18: { lineHeight: 24 },
  20: { lineHeight: 28 },
  24: { lineHeight: 32 },
  28: { lineHeight: 36 },
} as const;

/** Elevation levels, as `--lax-shadow-<level>`; level 0 is flat with a hairline. */
export const LAX_ELEVATION = {
  xs: "Secondary buttons and resting cards",
  md: "Menus, popovers, selects, tooltips and toasts",
  lg: "Dialogs, sheets and the command palette",
} as const;

/** The one focus ring: a 2px outline in `--lax-focus`, offset 2px (inset on rows). */
export const LAX_FOCUS_RING = { width: 2, offset: 2 } as const;

/** Status tones. Each has `--lax-<tone>-bg`, `-fg` and `-dot`; `live` is a solid fill. */
export const LAX_STATUS_TONES = ["neutral", "info", "success", "warning", "danger"] as const;
export type LaxStatusTone = (typeof LAX_STATUS_TONES)[number];

/** Surfaces a control, label or badge can sit on, as `--lax-<surface>`. */
export const LAX_SURFACES = ["canvas", "page", "side", "surface", "sunken", "raised"] as const;

/** Minimum contrast: text 4.5:1 (WCAG 1.4.3), control edges 3:1 (WCAG 1.4.11). */
export const LAX_MIN_CONTRAST = { text: 4.5, nonText: 3 } as const;

/**
 * Density layers, set with `data-lax-density` on the shell. They change only the type step,
 * control height and row height; every other token is shared.
 */
export const LAX_DENSITY = {
  staff: { text: 13, lineHeight: 20, control: 32, row: 36 },
  client: { text: 14, lineHeight: 20, control: 36, controlOnTouch: 44, row: 64 },
} as const;
export type LaxDensity = keyof typeof LAX_DENSITY;
