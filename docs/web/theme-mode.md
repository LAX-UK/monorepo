# Web theme mode (light / dark / Auto)

The marketing site and dashboard share a **class-based** theme: `html.dark` drives Tailwind `dark:` utilities and semantic CSS variables in [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css).

There is no `next-themes` provider. Theme state is resolved in three layers:

1. **Inline bootstrap** — [`ThemeInit`](../apps/web/src/components/layout/theme-init.tsx) runs a blocking script from [`theme-init-snippet.ts`](../apps/web/src/lib/csp/theme-init-snippet.ts) before first paint.
2. **SSR** — [`layout.tsx`](../apps/web/src/app/layout.tsx) sets the initial `<html>` class using the stored preference and optional `Sec-CH-Prefers-Color-Scheme`.
3. **Client sync** — [`applyThemeDom`](../apps/web/src/lib/preferences/apply-theme-dom.ts) updates DOM, `localStorage`, and the `lax_theme` cookie.

## Stored preference

| Value | UI label | Behaviour |
|-------|----------|-----------|
| `light` | Light | Always light |
| `dark` | Dark | Always dark |
| `system` | Auto | Follow OS `prefers-color-scheme` |

**Default for new users:** `system` ([`DEFAULT_THEME_PREFERENCE`](../../packages/validators/src/ui-preferences.ts), DB schema, API, and web fallbacks).

## Priority by layer

Device storage wins over the signed-in profile when both exist (e.g. header toggle succeeded locally but DB sync failed).

| Layer | Rule |
|-------|------|
| SSR | `lax_theme` cookie → seed cookie from DB when signed in and cookie absent → treat as `system` |
| Client mount (`SessionThemeSync`) | cookie / `localStorage` → else DB profile → `system` |
| Header toggle / Settings | writes DOM + cookie + `localStorage` (+ DB when signed in) |
| Auto (`system`) | OS changes via [`ThemeSystemListener`](../apps/web/src/components/layout/theme-system-listener.tsx); same-tab preference changes dispatch `lax:theme-preference-change` from [`applyThemeDom`](../apps/web/src/lib/preferences/apply-theme-dom.ts) |

Overall device priority: **cookie → localStorage → DB profile → system → OS**.

Signed-in users without device storage get the profile preference seeded server-side via [`resolveEffectiveThemePreference`](../apps/web/src/lib/preferences/sync-theme-cookie.server.ts). [`SessionThemeSync`](../apps/web/src/components/layout/session-theme-sync.tsx) mirrors the same priority on the client.

Shared resolver: [`resolveIsDarkClass`](../apps/web/src/lib/preferences/resolve-theme.ts).

## Session fetch gating

Root layout calls `/users/me` only when a Better Auth session cookie exists **and** the `lax_theme` cookie is absent ([`shouldFetchSessionForTheme`](../apps/web/src/lib/preferences/resolve-root-theme.server.ts), [`hasAuthSessionCookie`](../apps/web/src/lib/auth/session-cookie.ts)). Repeat signed-in visits with a device theme cookie skip the profile fetch entirely; the client still reads cookie/localStorage via [`SessionThemeSync`](../apps/web/src/components/layout/session-theme-sync.tsx).

## Performance

When `lax_theme` is already set, SSR uses the cookie directly and does **not** call `/users/me` for theme resolution. New devices (session cookie present, theme cookie absent) still fetch the profile once to seed the cookie.

## Control surfaces

| Surface | Location | Notes |
|---------|----------|-------|
| Settings → Appearance | [`appearance-layout-preferences-form.tsx`](../apps/web/src/components/settings/appearance-layout-preferences-form.tsx) | Light / Dark / Auto; persists to DB + cookie |
| Header toggle | [`theme-toggle.tsx`](../apps/web/src/components/layout/theme-toggle.tsx) | Binary Light ↔ Dark; overrides Auto until user picks Auto again |
| OS live updates | [`theme-system-listener.tsx`](../apps/web/src/components/layout/theme-system-listener.tsx) | Updates DOM when preference is `system` and OS theme changes |

## SSR / Client Hints

Middleware sends `Accept-CH` and `Critical-CH` for `Sec-CH-Prefers-Color-Scheme` so SSR can match the inline bootstrap when the preference is `system` or unset. See [`client-hint-headers.ts`](../apps/web/src/lib/preferences/client-hint-headers.ts).

## Known limits

- **PWA manifest** ([`manifest.json`](../apps/web/public/manifest.json)) uses static light/dark chrome colours; it does not follow the in-app theme toggle.
- **`viewport.themeColor`** in root layout follows OS media queries for browser chrome, not the resolved app theme.
- **Image overlay tone** (`data-overlay-tone`) is sampled per artwork and is independent of site light/dark mode.

## Visual exemptions

Some surfaces intentionally use fixed light-on-dark styling (photo overlays, hero scrims, live indicators) and are allowlisted in [`dark-mode-exemptions.json`](../apps/web/src/lib/theme/dark-mode-exemptions.json):

| Component | Reason |
|-----------|--------|
| [`watchlist-heart.tsx`](../apps/web/src/components/marketing/watchlist-heart.tsx) | White glass on artwork |
| [`thumb-pile-3-plus-n.tsx`](../apps/web/src/components/gallery/parts/thumb-pile-3-plus-n.tsx) | White glass on artwork |
| [`hero-progress-bar.tsx`](../apps/web/src/components/sections/home/hero/hero-progress-bar.tsx) | Decorative hero scrim |
| [`live-indicator.tsx`](../apps/web/src/components/sections/home/live-indicator.tsx) | Explicit `tone` prop, not site theme |
| [`media-placeholder.tsx`](../apps/web/src/components/ui/media-placeholder.tsx) | `light` / `dark` / `auto` variants |

Run `pnpm audit:dark-mode` to list unpaired light-only Tailwind classes. CI enforces the allowlist via [`dark-mode-visual.contract.test.ts`](../apps/web/src/lib/theme/dark-mode-visual.contract.test.ts).

## Tests

- [`resolve-theme.test.ts`](../apps/web/src/lib/preferences/resolve-theme.test.ts) — resolver matrix
- [`apply-theme-dom.test.ts`](../apps/web/src/lib/preferences/apply-theme-dom.test.ts) — DOM persistence + `applySystemThemeDom`
- [`read-stored-theme-preference.test.ts`](../apps/web/src/lib/preferences/read-stored-theme-preference.test.ts) — cookie/localStorage priority
- [`sync-theme-cookie.server.test.ts`](../apps/web/src/lib/preferences/sync-theme-cookie.server.test.ts) — SSR cookie seeding
- [`session-theme-sync.test.tsx`](../apps/web/src/components/layout/session-theme-sync.test.tsx) — device storage wins over profile
- [`session-cookie.test.ts`](../apps/web/src/lib/auth/session-cookie.test.ts) — auth cookie gate
- [`theme-init-snippet.test.ts`](../apps/web/src/lib/csp/theme-init-snippet.test.ts) — snippet ↔ resolver contract
- [`client-hint-headers.test.ts`](../apps/web/src/lib/preferences/client-hint-headers.test.ts) — middleware headers
- [`middleware.theme.test.ts`](../apps/web/src/middleware.theme.test.ts) — middleware wiring contract
- [`resolve-root-theme.server.test.ts`](../apps/web/src/lib/preferences/resolve-root-theme.server.test.ts) — layout session/theme gating
- [`theme-system-listener.test.tsx`](../apps/web/src/components/layout/theme-system-listener.test.tsx) — same-tab Auto re-sync
- [`dark-mode-visual.contract.test.ts`](../apps/web/src/lib/theme/dark-mode-visual.contract.test.ts) — unpaired light-only class guard
