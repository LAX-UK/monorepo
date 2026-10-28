import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { ArtHowToBuySteps } from "@/components/editorial/art-how-to-buy-steps";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { artServices } from "@/lib/art-services.server";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { howToBuySteps } from "@/lib/editorial/how-to-buy.vm";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

const SLUG = "how-to-buy";
const route = () => EDITORIAL_GUIDE_ROUTES[SLUG];

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage(SLUG), "How to buy");
}

/** The steps to buying an original, ending with the gallery team for anything they leave open. */
export default async function HowToBuyPage() {
  const [result, viewer] = await Promise.all([loadEditorialPage(SLUG), artServices.viewer.load()]);
  const band = (
    <ArtGalleryTeamBand team={buildArtGalleryTeam({ context: "howToBuy" })} viewer={viewer} />
  );
  const mapped =
    result.status === "ok" && result.data.canonicalPath === route()
      ? howToBuySteps(result.data.body.blocks)
      : null;

  // Bodies that do not follow the heading + prose + FAQ structure keep their authored layout.
  if (result.status !== "ok" || !mapped) {
    return (
      <ArtEditorialPageView
        result={result}
        routeFor={route}
        titleBand={{ density: "compact" }}
        closing={band}
      />
    );
  }

  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 pb-10 lg:pb-16")}>
      <MarketingPageTitle title={result.data.title} density="compact" />
      {mapped.preamble.length > 0 ? (
        <EditorialBlockRenderer
          body={{ blocks: mapped.preamble, rails: result.data.body.rails }}
          className="mx-auto w-full max-w-3xl"
        />
      ) : null}
      <ArtHowToBuySteps steps={mapped.steps} />
      <div className="mt-8 lg:mt-16">{band}</div>
    </article>
  );
}
