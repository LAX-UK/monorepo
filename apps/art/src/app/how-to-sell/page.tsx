import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { ArtSellingRoutes } from "@/components/editorial/art-selling-routes";
import { artServices } from "@/lib/art-services.server";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { buildSellingRoutes } from "@/lib/editorial/how-to-sell.vm";
import type { Metadata } from "next";

const SLUG = "how-to-sell";
const ROUTE = EDITORIAL_GUIDE_ROUTES[SLUG];
const route = () => ROUTE;

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage(SLUG), "How to sell");
}

/**
 * Rendered per request, as before the root layout stopped reading the visitor. Whether this page is
 * prerendered like the home page is decided per route (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const dynamic = "force-dynamic";

export default async function HowToSellPage() {
  const result = await loadEditorialPage(SLUG);
  const routes = buildSellingRoutes({
    crossProductLinks: artServices.ecosystem.crossProductLinks(),
    laxAccountUrl: artServices.account.laxAccountUrl,
  });
  return (
    <ArtEditorialPageView
      result={result}
      routeFor={route}
      titleBand={{}}
      aside={<ArtSellingRoutes routes={routes} />}
    />
  );
}
