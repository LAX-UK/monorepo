import { SHOP_CATALOGUE_VIEW_MODES } from "@/lib/catalogue/catalogue-view";
import {
  type CatalogLayoutView,
  resolveCatalogLayoutView,
  viewCookieName,
} from "@auction/marketing-ui";
import { cookies } from "next/headers";

/** `?view=` → `lax_view_<routeKey>` cookie → grid (shared LAX catalogue view contract). */
export async function resolveShopCatalogueView(
  routeKey: string,
  urlView: string | string[] | undefined,
): Promise<CatalogLayoutView> {
  const jar = await cookies();
  return resolveCatalogLayoutView({
    urlView: typeof urlView === "string" ? urlView : urlView?.[0],
    cookieRaw: jar.get(viewCookieName(routeKey))?.value,
    modes: SHOP_CATALOGUE_VIEW_MODES,
    fallback: "grid",
  });
}
