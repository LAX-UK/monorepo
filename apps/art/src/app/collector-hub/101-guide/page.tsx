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

// Editorial pages carry no cover image yet, so the guide index uses the plain title band.
export default async function CollectingGuidePage() {
  return (
    <ArtEditorialPageView
      result={await loadEditorialPage(SLUG)}
      routeFor={route}
      titleBand={{
        subtitle:
          "A growing series of guides designed to make the art world easier to understand, one subject at a time.",
        chip: { label: "Collecting guide" },
      }}
    />
  );
}
