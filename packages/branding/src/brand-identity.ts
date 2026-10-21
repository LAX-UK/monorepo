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
  shop: null,
  art: null,
  account: null,
};
