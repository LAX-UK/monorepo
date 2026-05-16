import "server-only";

import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { parseLayoutViewCookie, viewCookieName } from "@/lib/preferences/view-cookie";
import { cookies } from "next/headers";

/**
 * Cookie-only view hint for loading UI. Full pages also resolve URL + DB prefs;
 * `loading.tsx` cannot read request `searchParams`, so a shared `?view=` deep link
 * from another device may briefly show the route default until the page renders.
 */
export async function readSkeletonView(
  routeKey: string,
  fallback: CatalogLayoutView,
): Promise<CatalogLayoutView> {
  const jar = await cookies();
  const raw = jar.get(viewCookieName(routeKey))?.value;
  return parseLayoutViewCookie(raw) ?? fallback;
}
