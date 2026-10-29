import { type LaxBrandProduct, PRODUCT_ACCENTS, PRODUCT_ACCENTS_ON_DARK } from "@auction/branding";
import type { CSSProperties } from "react";

/** Read by the underline utilities in `lax-family-bar.tsx`; unset, the underline keeps the text colour. */
const ACCENT_VAR = "--family-accent";
const ACCENT_ON_DARK_VAR = "--family-accent-on-dark";

const isProduct = (id: string): id is LaxBrandProduct => id in PRODUCT_ACCENTS;

/**
 * The product accent a family link underlines itself with, as CSS variables so one class list
 * serves both themes. A product without an accent (lax.art, the umbrella) returns nothing and the
 * underline follows the text colour.
 */
export function familyLinkAccentStyle(id: string): CSSProperties | undefined {
  if (!isProduct(id)) return undefined;
  const light = PRODUCT_ACCENTS[id];
  const dark = PRODUCT_ACCENTS_ON_DARK[id];
  if (!light || !dark) return undefined;
  return { [ACCENT_VAR]: light, [ACCENT_ON_DARK_VAR]: dark } as CSSProperties;
}
