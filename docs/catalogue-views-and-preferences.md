# Adding a catalogue view to a marketing screen

1. Pick a stable **`routeKey`** (e.g. `search`, `archive`, `sales`) and add it to [`MARKETING_VIEW_COOKIE_ROUTE_KEYS`](../apps/web/src/lib/preferences/list-views.ts) if users should be able to reset its cookie from settings.
2. On the **server page**, call `resolveMarketingLayoutView({ routeKey, category, urlView, user, fallback })` with the correct `ViewCategory` (`lots` | `artists` | `sales`).
3. Render **`CatalogViewSwitcher`** (client) with the same `routeKey` and the resolved `value`.
4. Split the list UI into **presentational** view components (grid / card / list) under `apps/web/src/components/marketing/` or `components/sections/…` — no data fetching inside those components.
5. Preserve **`view`** in all query-building helpers (`withQuery`, filter forms, pagination) so filters and pagination do not drop layout.

# SOLID layering for UI preferences

| Concern | Module |
|--------|--------|
| Pure resolution (no I/O) | [`resolve-layout-view.ts`](../apps/web/src/lib/preferences/resolve-layout-view.ts) |
| Server + cookie read | [`resolve-marketing-layout-view.server.ts`](../apps/web/src/lib/preferences/resolve-marketing-layout-view.server.ts) |
| Cookie name / parse | [`view-cookie.ts`](../apps/web/src/lib/preferences/view-cookie.ts) |
| Marketing route registry | [`list-views.ts`](../apps/web/src/lib/preferences/list-views.ts) |
| API contract | [`packages/validators/src/ui-preferences.ts`](../packages/validators/src/ui-preferences.ts) |
| Persistence (HTTP) | [`UiPrefsService`](../apps/web/src/lib/services/impl/ui-prefs.service.ts) + server actions in [`user-ui-preferences.ts`](../apps/web/src/lib/actions/user-ui-preferences.ts) |
| DB row | `user_ui_preference` + Drizzle repository |

Pages depend only on **`resolveMarketingLayoutView`** and presentational components — not on `fetch`, Drizzle, or raw `cookies()` except inside the server helper.
