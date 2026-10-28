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
import { buildHomePageViewModel } from "@/lib/home/home-page.vm";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";

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
      <HomeHero hero={vm.hero} quickFilters={vm.quickFilters} />
      <HomeTrustStrip items={vm.trust} />
      <NewEditionsSection
        editions={vm.newEditions}
        errorMessage={vm.sectionErrors.editions}
        now={now}
      />
      <HomeStorySection story={vm.story} />
      <HomeArtistsSection artists={vm.artists} />
      <HomeCollectionsSection collections={vm.collections} />
      <ShopGalleryTeamBand team={vm.galleryTeam} />
      <ShopProductDoors doors={vm.doors} />
    </>
  );
}
