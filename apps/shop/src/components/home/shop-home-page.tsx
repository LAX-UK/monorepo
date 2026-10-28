import { ShopGalleryTeamBand } from "@/components/gallery-team/shop-gallery-team-band";
import { HomeHero } from "@/components/home/sections/home-hero";
import {
  HomeArtistsSection,
  HomeCollectionsSection,
  HomeStorySection,
  NewEditionsSection,
} from "@/components/home/sections/home-sections";
import { HomeTrustStrip } from "@/components/home/sections/home-trust-strip";
import { ShopProductDoors } from "@/components/product-doors/shop-product-doors";
import { loadCheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery.server";
import {
  loadShopArtBaseUrl,
  loadShopProductDirectoryLinks,
} from "@/lib/ecosystem/product-directory.server";
import { shopApiHomeCatalogueReader } from "@/lib/home/home-catalogue.adapter.server";
import { composeHomePageData } from "@/lib/home/home-page.composer";
import { type HomePageViewModel, buildHomePageViewModel } from "@/lib/home/home-page.vm";
import type { HomeSectionId } from "@/lib/home/home-sections";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";

/** One home section; the view model decides which are shown and in what order. */
function HomeSection({ id, vm, now }: { id: HomeSectionId; vm: HomePageViewModel; now: Date }) {
  switch (id) {
    case "hero":
      return <HomeHero hero={vm.hero} quickFilters={vm.quickFilters} />;
    case "trust":
      return <HomeTrustStrip items={vm.trust} />;
    case "new-editions":
      return (
        <NewEditionsSection
          editions={vm.newEditions}
          errorMessage={vm.sectionErrors.editions}
          now={now}
        />
      );
    case "story":
      return <HomeStorySection story={vm.story} />;
    case "artists":
      return <HomeArtistsSection artists={vm.artists} />;
    case "collections":
      return <HomeCollectionsSection collections={vm.collections} />;
    case "product-doors":
      return <ShopProductDoors doors={vm.doors} />;
    case "gallery-team":
      return <ShopGalleryTeamBand team={vm.galleryTeam} />;
  }
}

export async function ShopHomePage() {
  const now = new Date();
  const vm = buildHomePageViewModel(await composeHomePageData(shopApiHomeCatalogueReader), {
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
