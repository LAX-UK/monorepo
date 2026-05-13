/**
 * Email + shared hex tokens. Values mirror `@theme` in `apps/web/src/app/globals.css`
 * (light theme). Kept in sync by `tests/tokens.test.ts`.
 *
 * Accessibility: gold `#d4af37` is low-contrast on white — use only for accents
 * (dots, rules), not body text. Links use navy. Body text uses textPrimary.
 */

export const COLORS = {
  /** `--color-brand-900` */
  ink: "#050505",
  /** `--color-page-bg` (light) */
  paper: "#f1f1f3",
  /** `--color-surface-container-lowest` */
  surface: "#ffffff",
  /** `--color-brand-500` */
  textPrimary: "#191919",
  /** `--color-brand-400` */
  textSecondary: "#474747",
  /** `--color-brand-300` */
  textMuted: "#757575",
  /** `--color-nav-border` */
  border: "#e6e8eb",
  /** `--color-footer-soft` */
  borderSoft: "#ededef",
  /** Primary wordmark navy in `apps/web/public/logo.svg` (`.cls-2`) */
  link: "#091f5b",
  /** `--color-accent-gold` */
  gold: "#d4af37",
  /** `--color-live-red` */
  red: "#e83030",
  /** Same as textSecondary — category accent for account/admin */
  graphite: "#474747",
  /** `--color-cta-bg` */
  ctaBg: "#050505",
  /** `--color-cta-on` */
  ctaOn: "#f1f1f3",
} as const;

/** Mirrors `--radius-lg` (0.25rem) */
export const EMAIL_RADIUS_PX = 4;

export const FONT_STACK_BODY = 'Helvetica, Arial, "Helvetica Neue", sans-serif' as const;
export const FONT_STACK_HEADING = 'Georgia, "Times New Roman", Times, serif' as const;

export type EmailCategory = "account" | "auction" | "finance" | "alert" | "admin";

/** Accent colour for eyebrow dot + top rule per email category */
export function categoryAccentColor(category: EmailCategory): string {
  switch (category) {
    case "auction":
      return COLORS.gold;
    case "finance":
      return COLORS.link;
    case "alert":
      return COLORS.red;
    case "account":
    case "admin":
      return COLORS.graphite;
  }
}
