import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { parseLayoutViewCookie } from "@/lib/preferences/view-cookie";

export type ViewCategory = "lots" | "artists" | "sales";

type UiPrefsSlice = {
  viewLotsDefault?: "grid" | "card" | "list" | "auto";
  viewArtistsDefault?: "grid" | "card" | "list" | "auto";
  viewSalesDefault?: "grid" | "card" | "list" | "auto";
  viewSync?: boolean;
};

function categoryDefault(
  category: ViewCategory,
  prefs: UiPrefsSlice | undefined,
): CatalogLayoutView | null {
  if (!prefs) return null;
  const raw =
    category === "lots"
      ? prefs.viewLotsDefault
      : category === "artists"
        ? prefs.viewArtistsDefault
        : prefs.viewSalesDefault;
  if (raw === "grid" || raw === "card" || raw === "list") return raw;
  return null;
}

/** Parse `?view=` (grid | card | list). */
export function parseUrlLayoutView(raw: string | null | undefined): CatalogLayoutView | null {
  return parseLayoutViewCookie(raw ?? null);
}

/** Pure resolution: URL → (sync+default) → cookie → default → fallback. */
export function resolveLayoutView(args: {
  urlView: string | null | undefined;
  category: ViewCategory;
  uiPreferences: UiPrefsSlice | null | undefined;
  cookieRaw: string | null | undefined;
  fallback: CatalogLayoutView;
}): CatalogLayoutView {
  const fromUrl = parseUrlLayoutView(args.urlView);
  if (fromUrl) return fromUrl;

  const def = () => categoryDefault(args.category, args.uiPreferences ?? undefined);

  if (args.uiPreferences?.viewSync === true) {
    const d = def();
    if (d) return d;
  }

  const fromCookie = parseLayoutViewCookie(args.cookieRaw);
  if (fromCookie) return fromCookie;

  const d2 = def();
  if (d2) return d2;

  return args.fallback;
}
