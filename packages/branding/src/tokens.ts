/**
 * Email + shared hex tokens. Values mirror `@theme` in `apps/web/src/app/globals.css`
 * (light theme). Kept in sync by `tests/tokens.test.ts`.
 *
 * Accessibility: gold `#d4af37` is low-contrast on white — use only for accents
 * (dots, rules), not body text. Links use midnight. Body text uses textPrimary.
 */

import {
  BRAND_COLORS,
  BRAND_FONTS,
  type LaxBrandProduct,
  PRODUCT_ACCENTS,
} from "./brand-identity.js";

export const COLORS = {
  /** `--color-brand-900` / `--color-brand-obsidian` */
  ink: BRAND_COLORS.obsidian,
  /** `--color-page-bg` — neutral web shell (not brand cream) */
  pageBg: "#ffffff",
  /** `--color-paper` — warm brand paper for email */
  paper: BRAND_COLORS.lightCream,
  /** `--color-surface-container-lowest` */
  surface: "#ffffff",
  /** `--color-brand-500` */
  textPrimary: "#191919",
  /** `--color-brand-400` / `--color-on-surface-variant` */
  textSecondary: "#525252",
  /** `--color-brand-300` */
  textMuted: "#757575",
  /** `--color-nav-border` */
  border: "#e6e8eb",
  /** `--color-footer-soft` */
  borderSoft: "#ededef",
  /** `--color-link` / `--color-brand-midnight` */
  link: BRAND_COLORS.midnight,
  /** `--color-accent-gold` — functional auction accent, not brand primary */
  gold: "#d4af37",
  /** `--color-live-red` */
  red: "#e83030",
  /** Same as textSecondary — category accent for account/admin */
  graphite: "#525252",
  /** `--color-cta-bg` */
  ctaBg: BRAND_COLORS.obsidian,
  /** `--color-cta-on` */
  ctaOn: BRAND_COLORS.lightCream,
} as const;

/** Mirrors `--radius-lg` (0.25rem) */
export const EMAIL_RADIUS_PX = 4;

/**
 * Email-safe stacks: brand fonts with system fallbacks (clients rarely load webfonts).
 * Outfit for the interface and body, Montserrat for titles only.
 */
export const FONT_STACK_BODY =
  `"${BRAND_FONTS.secondary}", Helvetica, Arial, "Helvetica Neue", sans-serif` as const;
export const FONT_STACK_HEADING =
  `"${BRAND_FONTS.primary}", Helvetica, Arial, "Helvetica Neue", sans-serif` as const;
export const FONT_STACK_SUPPORTING = FONT_STACK_BODY;

export type EmailCategory = "account" | "auction" | "finance" | "alert" | "admin";

/**
 * Accent for an email's eyebrow dot and heading rule: the sending product's accent (Bid navy,
 * Account teal), or ink for products without one (Shop, lax.art). Alerts keep the status red.
 */
export function emailAccentColor(product: LaxBrandProduct, category: EmailCategory): string {
  if (category === "alert") return COLORS.red;
  return PRODUCT_ACCENTS[product] ?? COLORS.ink;
}
