import { ShopGalleryTeamBand } from "@/components/gallery-team/shop-gallery-team-band";
import { HomeArtistsSection } from "@/components/home/sections/home-artists";
import { HomeBrowseSection } from "@/components/home/sections/home-browse";
import { HomeCollectionsSection } from "@/components/home/sections/home-collections";
import { HomeCover } from "@/components/home/sections/home-cover";
import { HomeHangSection } from "@/components/home/sections/home-hang-section";
import { NewEditionsSection } from "@/components/home/sections/home-new-editions";
import { HomeTrustStrip } from "@/components/home/sections/home-trust-strip";
import { ShopProductDoors } from "@/components/product-doors/shop-product-doors";
import { ShopReleaseAlertsBand } from "@/components/release-alerts/shop-release-alerts-band";
import { loadCheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery.server";
import {
  loadShopArtBaseUrl,
  loadShopProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { shopApiHomeCatalogueReader } from "@/lib/home/home-catalogue.adapter.server";
import { readImageFacts } from "@/lib/home/home-image-facts";
import { shopImageProbe } from "@/lib/home/home-image-probe.server";
import { composeHomePageData } from "@/lib/home/home-page.composer";
import { type HomePageViewModel, buildHomePageViewModel } from "@/lib/home/home-page.vm";
import { homePhotographAddresses } from "@/lib/home/home-release";
import type { HomeSectionId } from "@/lib/home/home-sections";
import { loadShopCatalogueImageOrigins } from "@/lib/media/catalogue-image.server";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { type PublicArtworkSummary, createCatalogueImageResolver } from "@auction/shop-contracts";

/** One home section; the view model decides which are shown and in what order. */
function HomeSection({ id, vm, now }: { id: HomeSectionId; vm: HomePageViewModel; now: Date }) {
  switch (id) {
    case "hero":
      return (
        <HomeCover
          hero={vm.hero}
          plate={vm.coverPlate}
          catalogueFailed={Boolean(vm.sectionErrors.editions)}
        />
      );
    case "hang":
      return vm.hang ? <HomeHangSection hang={vm.hang} /> : null;
    case "browse":
      return <HomeBrowseSection rows={vm.hero.browseRows} />;
    case "trust":
      return <HomeTrustStrip trust={vm.trust} />;
    case "new-editions":
      return (
        <NewEditionsSection
          editions={vm.newEditions}
          errorMessage={vm.sectionErrors.editions}
          now={now}
        />
      );
    case "artists":
      return <HomeArtistsSection artists={vm.artists} />;
    case "collections":
      return <HomeCollectionsSection collections={vm.collections} />;
    case "release-alerts":
      return <ShopReleaseAlertsBand tinted={vm.layout.surfaces["release-alerts"] === "band"} />;
    case "product-doors":
      return <ShopProductDoors doors={vm.doors} />;
    case "gallery-team":
      return <ShopGalleryTeamBand team={vm.galleryTeam} />;
  }
}

export async function ShopHomePage() {
  const now = new Date();
  const data = await composeHomePageData(shopApiHomeCatalogueReader);
  const resolveImage = createCatalogueImageResolver("shop", loadShopCatalogueImageOrigins());
  const imageSrc = (item: PublicArtworkSummary) => resolveImage(item.imageUrl);
  const imageFacts = await readImageFacts(shopImageProbe, homePhotographAddresses(data, imageSrc));
  const vm = buildHomePageViewModel(data, {
    imageSrc,
    imageFacts,
    now,
    artBaseUrl: loadShopArtBaseUrl(),
    productLinks: loadShopProductDirectoryLinks(),
    linkablePolicies: loadLinkableShopPolicies(),
    deliveryTimes: loadCheckoutDeliveryTimes(),
  });

  return (
    <>
      {vm.layout.sections.map((id) => (
        <HomeSection key={id} id={id} vm={vm} now={now} />
      ))}
    </>
  );
}
