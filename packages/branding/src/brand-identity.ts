/**
 * Brand Identity v1.0 — immutable primitives.
 * CSS mappings live in `apps/web/src/app/globals.css` @theme;
 * semantic email mirror in `tokens.ts`.
 */

export const BRAND_COLORS = {
  /** Obsidian Nocturne — authority, primary brand black */
  obsidian: "#000000",
  /** Midnight Blue — LAX Bid's product accent only (see `PRODUCT_ACCENTS`) */
  midnight: "#091f5b",
  /** Light Gray — clean supporting tone */
  lightGray: "#b8b9c0",
  /** Light Cream — warm page/surface balance */
  lightCream: "#f2f1df",
} as const;

/**
 * Shared surfaces. Paper is the soft warm off-white behind artwork and editorial bands on lax.art
 * and Shop, lighter than the palette's light cream; `paperOnDark` is its dark-mode equivalent. CSS: `--brand-paper` and
 * `--brand-paper-on-dark` in `brand-primitives.css`, which each product maps to
 * `--color-surface-paper`.
 *
 * `workMatEdgeOnDark` is the hairline drawn inside a work's mat in dark mode, where the dark paper
 * sits almost on the page tone; it keeps every work's edge. CSS: `--brand-work-mat-edge-on-dark`,
 * which Shop and lax.art map to `--color-work-mat-edge`.
 */
export const BRAND_SURFACES = {
  paper: "#f6f4ee",
  paperOnDark: "#1a1b1a",
  workMatEdgeOnDark: "#2f302f",
} as const;

/**
 * The edge of a text field, select or search box in every product: 3:1 or more (WCAG 1.4.11)
 * against each product's page, surface and container tints, light and dark, so a field that has
 * no other boundary is always visible. CSS: `--brand-field-edge` and `--brand-field-edge-on-dark`
 * in `brand-primitives.css`, which each product maps to `--color-input-border`.
 */
export const BRAND_FIELD_EDGE = {
  light: "#808080",
  onDark: "#858585",
} as const;

export const BRAND_FONTS = {
  /** Primary typeface — headlines, body, labels */
  primary: "Montserrat",
  /** Secondary typeface — supporting UI, footer links */
  secondary: "Outfit",
} as const;

export type BrandColor = (typeof BRAND_COLORS)[keyof typeof BRAND_COLORS];

export type LaxBrandProduct = "bid" | "shop" | "art" | "account";

/**
 * LAX colour rule (docs/DESIGN_SYSTEM.md): every product shares the palette above and owns at most
 * one accent no other product uses. `null` means not chosen yet — the product uses neutrals only.
 */
export const PRODUCT_ACCENTS: Readonly<Record<LaxBrandProduct, string | null>> = {
  bid: BRAND_COLORS.midnight,
  /** Aubergine: 10.9:1 on white, 9.4:1 on #eeeeee. Owner choice 2026-10-26; never a status colour. */
  shop: "#5a2a5c",
  art: null,
  /** Deep teal: AA text colour on white (5.47:1). Never a success colour; see PRODUCT_ACCENTS_ON_DARK. */
  account: "#0f766e",
};

/**
 * The same accents re-tuned for dark surfaces, where the light-surface values lose contrast.
 * `null` means the product has no dark-surface accent: its lockup falls back to a neutral.
 */
export const PRODUCT_ACCENTS_ON_DARK: Readonly<Record<LaxBrandProduct, string | null>> = {
  /**
   * Navy lifted to a light tint of the same hue (224 degrees), so Bid's name stays recognisably
   * Bid's on a dark surface: about 8.6:1 on Account's dark surface. Bid's dark lockup keeps its
   * master's light-grey descriptor; this is for the product's name set as text.
   */
  bid: "#a5b7e9",
  /** Light aubergine: 9.2:1 on the Shop dark page #121414, 6.7:1 on #2d2f2e. */
  shop: "#d6a8d4",
  art: null,
  /** Bright teal: about 10:1 on the Account dark page surface. */
  account: "#2dd4bf",
};
