import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadGuideIndex } from "@/lib/editorial/guide-index.loader.server";
import { MarketingReveal } from "@auction/marketing-ui";
import type { Metadata } from "next";

const SLUG = "101-guide";
const route = () => EDITORIAL_GUIDE_ROUTES[SLUG];

/** The page view and metadata take the page alone; the guide cards ride along separately. */
function pageResult(index: Awaited<ReturnType<typeof loadGuideIndex>>) {
  return index.status === "ok" ? { status: "ok" as const, data: index.data.page } : index;
}

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(pageResult(await loadGuideIndex(SLUG)), "Collecting 101");
}

// Editorial pages carry no cover image yet, so the guide index uses the plain title band.
export default async function CollectingGuidePage() {
  const index = await loadGuideIndex(SLUG);
  const guides = index.status === "ok" ? index.data.guides : [];
  return (
    <ArtEditorialPageView
      result={pageResult(index)}
      routeFor={route}
      titleBand={{
        subtitle:
          "A growing series of guides designed to make the art world easier to understand, one subject at a time.",
        chip: { label: "Collecting guide" },
      }}
      afterBody={
        guides.length > 0 ? (
          <MarketingReveal index={0}>
            <ArtEditorialCardGrid cards={guides} ariaLabel="Collecting guides" priorityCount={3} />
          </MarketingReveal>
        ) : null
      }
    />
  );
}
