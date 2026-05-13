import { THEME_INIT_SNIPPET } from "@/lib/csp/theme-init-snippet";

/**
 * Inline script that runs before paint to set theme + reduce-motion attributes.
 *
 * Uses a raw `<script>` tag instead of `next/script` because:
 *   - `next/script` with `strategy="beforeInteractive"` injects a wrapper that
 *     causes a hydration mismatch on the `nonce` attribute (server renders
 *     empty string, client renders undefined).
 *   - We need this to run synchronously before first paint to avoid theme
 *     flicker — a plain inline `<script>` in `<head>` does that natively.
 *
 * CSP allows this script via a static `sha256-...` hash (see middleware); no
 * `nonce` on this tag avoids browser clearing nonce and React hydration noise.
 */
export function ThemeInit() {
  return (
    <script
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline script for theme init
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SNIPPET }}
    />
  );
}
