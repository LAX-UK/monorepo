import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import type { Metadata } from "next";

const SLUG = "101-guide";
const route = () => EDITORIAL_GUIDE_ROUTES[SLUG];

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage(SLUG), "Collecting 101");
}

export default async function CollectingGuidePage() {
  return (
    <ArtEditorialPageView
      result={await loadEditorialPage(SLUG)}
      routeFor={route}
      breadcrumbs={[{ label: "Collector Hub", href: "/collector-hub" }]}
    />
  );
}
