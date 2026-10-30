/**
 * The staff design scales, as data. theme.css is the source the browser reads; this module names
 * the same steps for code that has to reason about them (tests, the component sheet, docs), and a
 * test keeps the two in step.
 *
 * Spacing follows Tailwind's 4px unit and uses the 4/8 rhythm only: 1, 2, 3, 4, 5, 6, 8, 10, 12
 * (4px to 48px). Half steps (0.5) are reserved for optical nudges of 2px inside a control.
 */
export const STAFF_SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;

/** Font size and line height in px, as class suffix `text-staff-<step>`. */
export const STAFF_TYPE_SCALE = {
  "2xs": { size: 11, lineHeight: 16, use: "Digits in counters and kbd glyphs only, never words" },
  xs: { size: 12, lineHeight: 16, use: "Captions, column headers, badges, helper text" },
  sm: { size: 13, lineHeight: 20, use: "Default interface text: tables, controls, menus, nav" },
  md: { size: 14, lineHeight: 20, use: "Form values, panel body, section titles" },
  lg: { size: 16, lineHeight: 24, use: "Panel and dialog titles" },
  xl: { size: 20, lineHeight: 28, use: "Page titles" },
} as const;

/** Weights: 400 body, 500 interactive labels and emphasised values, 600 titles. */
export const STAFF_FONT_WEIGHTS = { regular: 400, medium: 500, semibold: 600 } as const;

/** Corner radius in px, as `rounded-staff-<step>`. */
export const STAFF_RADIUS = {
  xs: { px: 4, use: "Badges, checkboxes, kbd" },
  sm: { px: 6, use: "Buttons, inputs, selects, nav items, menu items" },
  md: { px: 8, use: "Menus, popovers, toasts, the bulk-action bar" },
  lg: { px: 12, use: "Cards, tables, notices, dialogs, sheets, the command palette" },
} as const;

/** Control heights in px, as `h-control-<step>`. */
export const STAFF_CONTROL_HEIGHT = {
  xs: { px: 24, use: "Inline: badges, kbd, row icon buttons" },
  sm: { px: 32, use: "Compact: toolbars, filters, table actions, top bar" },
  md: { px: 36, use: "Default: forms and page actions" },
  lg: { px: 40, use: "Large: the command palette field" },
} as const;

/** Table row heights per density. */
export const STAFF_ROW_HEIGHT = { compact: 36, comfortable: 44 } as const;

/** Borders: every hairline is 1px; focus is a 2px ring offset 2px (inset for rows). */
export const STAFF_BORDER = { hairline: 1, focusRing: 2, focusOffset: 2 } as const;

/** Elevation levels, as `shadow-staff-<level>`; level 0 is flat with a hairline. */
export const STAFF_ELEVATION = {
  0: "Page, cards, tables: flat, hairline border",
  xs: "Secondary buttons",
  md: "Menus, popovers, selects, tooltips, the bulk-action bar",
  lg: "Dialogs, sheets, the command palette",
} as const;

/** Icons: lucide, 1.75 stroke at every size. */
export const STAFF_ICON = {
  stroke: 1.75,
  sizes: { sm: 14, md: 16, lg: 20 },
  use: "14 inside badges and compact buttons, 16 in controls and nav, 20 for empty states",
} as const;

/** Layout. */
export const STAFF_LAYOUT = {
  sidebarWidth: 240,
  sidebarCollapsedWidth: 56,
  topBarHeight: 52,
  contentMaxWidth: 1280,
  detailPanelWidth: 480,
  gutter: { mobile: 16, desktop: 32 },
} as const;

/**
 * Heights the page reserves for sticky layers, as `--spacing-staff-<name>`, so a focused element
 * is never scrolled beneath them: the top bar, a sticky table header, and the floating bulk-action
 * bar (its 42px bar, 16px offset and a margin).
 */
export const STAFF_STICKY_LAYERS = {
  "top-bar": 52,
  "table-header": 36,
  "bulk-bar-clearance": 72,
} as const;

/**
 * Form-control boundaries keep at least this contrast against every surface they sit on
 * (WCAG 1.4.11 non-text contrast). Applies to `control-border` and `control-border-hover`.
 */
export const STAFF_CONTROL_BORDER_MIN_CONTRAST = 3;

/**
 * Status tones. `live` is Bid's "happening now" (a lot or sale open for bidding): a solid fill
 * with a pulsing dot, kept apart from `danger`, which means failed, blocked or withdrawn.
 */
export const STAFF_STATUS_TONES = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "live",
] as const;
export type StaffStatusTone = (typeof STAFF_STATUS_TONES)[number];
