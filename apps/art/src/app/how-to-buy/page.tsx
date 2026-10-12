import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { EDITORIAL_GUIDE_ROUTES } from "@/lib/editorial/editorial-page-routes";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

const SLUG = "how-to-buy";
const route = () => EDITORIAL_GUIDE_ROUTES[SLUG];

export async function generateMetadata(): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage(SLUG), "How to buy");
}

export default async function HowToBuyPage() {
  return (
    <ArtEditorialPageView
      result={await loadEditorialPage(SLUG)}
      routeFor={route}
      aside={
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="min-h-11 font-label uppercase tracking-wide">
            <Link href="/artworks">Browse artworks</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-11 font-label uppercase tracking-wide"
          >
            <Link href="/contact">Talk to an advisor</Link>
          </Button>
        </div>
      }
    />
  );
}
