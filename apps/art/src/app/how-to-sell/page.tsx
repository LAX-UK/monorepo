import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { artServices } from "@/lib/art-services.server";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import type { Metadata } from "next";

const SLUG = "how-to-sell";
const ROUTE = EDITORIAL_GUIDE_ROUTES[SLUG];
const route = () => ROUTE;

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage(SLUG), "How to sell");
}

export default async function HowToSellPage() {
  const [result, viewer] = await Promise.all([loadEditorialPage(SLUG), artServices.viewer.load()]);
  return (
    <ArtEditorialPageView
      result={result}
      routeFor={route}
      titleBand={{}}
      aside={
        <>
          <h2 className="font-headline text-xl font-semibold text-on-surface">
            Sell a work with us
          </h2>
          <p className="text-on-surface-variant">
            Share a few details about the work and a specialist will be in touch.
          </p>
          <ArtGeneralEnquiryPanel
            viewer={viewer}
            defaultTopic="selling"
            triggerLabel="Start a selling enquiry"
          />
        </>
      }
    />
  );
}
