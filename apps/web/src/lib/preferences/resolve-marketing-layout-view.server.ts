import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { resolveLayoutView } from "@/lib/preferences/resolve-layout-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { viewCookieName } from "@/lib/preferences/view-cookie";
import { cookies } from "next/headers";

export async function resolveMarketingLayoutView(opts: {
  routeKey: string;
  category: "lots" | "artists" | "sales";
  urlView: string | null | undefined;
  user: SessionUser | null;
  fallback: CatalogLayoutView;
}): Promise<CatalogLayoutView> {
  const jar = await cookies();
  const cookieRaw = jar.get(viewCookieName(opts.routeKey))?.value;
  return resolveLayoutView({
    urlView: opts.urlView,
    category: opts.category,
    uiPreferences: opts.user?.uiPreferences,
    cookieRaw,
    fallback: opts.fallback,
  });
}
