import { buildThemeInitSnippet } from "@/lib/csp/build-theme-init-snippet";

/** Inline theme + reduce-motion bootstrap; must match bytes in ThemeInit and CSP hash in middleware.
 * Priority: cookie `lax_theme` → localStorage `theme` → `prefers-color-scheme`.
 * Values: `light` | `dark` | `system` (see {@link THEME_COOKIE_NAME}). */
export const THEME_INIT_SNIPPET = buildThemeInitSnippet();
