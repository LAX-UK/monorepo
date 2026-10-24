import { AccountShell } from "@/components/account-shell";
import { ArtistArtworksList, ArtistSalesList } from "@/components/selling/selling-artworks";
import { SellingPageHeader, openSellingPage } from "@/components/selling/selling-page";
import { SellingListSkeleton, SellingLoadError } from "@/components/selling/selling-parts";
import { loadArtistSection } from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import type { SessionHandle } from "@/server/ports/portfolio-gateway";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your artworks · LAX Account" };

async function ArtistSection({ handle }: { handle: SessionHandle }) {
  const loaded = await loadArtistSection(handle);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError
        title="We couldn't load your artworks"
        retryHref={SELLING_ROUTES.artworks}
      />
    );
  }
  return (
    <>
      <ArtistArtworksList artworks={loaded.view.artworks} />
      <ArtistSalesList sales={loaded.view.sales} />
    </>
  );
}

/** For artists: their works on LAX and every recorded sale of them. */
export default async function SellingArtworksPage() {
  const opened = await openSellingPage("artworks");
  if ("unavailable" in opened) return opened.unavailable;
  return (
    <AccountShell width="wide">
      <SellingPageHeader
        ready={opened.ready}
        tool="artworks"
        title="Your artworks"
        description="Your works listed on LAX, and every recorded sale of them, including resales."
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-8">
            <SellingListSkeleton label="Loading your artworks" />
            <SellingListSkeleton rows={2} label="Loading sales of your work" />
          </div>
        }
      >
        <ArtistSection handle={opened.ready.handle} />
      </Suspense>
    </AccountShell>
  );
}
