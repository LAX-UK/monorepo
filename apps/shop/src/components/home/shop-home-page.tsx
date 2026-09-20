import { CatalogueStatusSection } from "@/components/home/sections/catalogue-status-section";
import { CategoriesSection } from "@/components/home/sections/categories-section";
import { FeaturedArtistsSection } from "@/components/home/sections/featured-artists-section";
import { HeroSection } from "@/components/home/sections/hero-section";
import { OriginalsSection } from "@/components/home/sections/originals-section";
import { PrintsSection } from "@/components/home/sections/prints-section";
import { SignupSection } from "@/components/home/sections/signup-section";
import { ShopReveal } from "@/components/home/shop-reveal";
import { composeHomePageData } from "@/lib/home/home-page.composer";
import { buildHomePageViewModel } from "@/lib/home/home-page.vm";
import { homeSignupCta } from "@/lib/home/signup-cta";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";

export async function ShopHomePage() {
  const [data, viewer] = await Promise.all([composeHomePageData(), loadShopViewerState()]);
  const vm = buildHomePageViewModel(data);
  const failedSections = Object.keys(vm.sectionErrors);
  const showGlobalAlert = failedSections.length === 4;

  return (
    <>
      <HeroSection hero={vm.hero} />
      {showGlobalAlert ? (
        <CatalogueStatusSection message="Catalogue sections are temporarily unavailable." />
      ) : null}
      <ShopReveal index={1}>
        <OriginalsSection
          section={vm.sections.originals}
          cards={vm.originals}
          {...(vm.sectionErrors.originals ? { errorMessage: vm.sectionErrors.originals } : {})}
        />
      </ShopReveal>
      <ShopReveal index={2}>
        <CategoriesSection
          section={vm.sections.categories}
          cards={vm.categories}
          {...(vm.sectionErrors.categories ? { errorMessage: vm.sectionErrors.categories } : {})}
        />
      </ShopReveal>
      <ShopReveal index={3}>
        <PrintsSection
          section={vm.sections.prints}
          cards={vm.printCards}
          {...(vm.sectionErrors.prints ? { errorMessage: vm.sectionErrors.prints } : {})}
        />
      </ShopReveal>
      <ShopReveal index={4}>
        <FeaturedArtistsSection
          section={vm.sections.artists}
          cards={vm.artists}
          {...(vm.sectionErrors.artists ? { errorMessage: vm.sectionErrors.artists } : {})}
        />
      </ShopReveal>
      <ShopReveal index={5}>
        <SignupSection signup={vm.signup} cta={homeSignupCta(viewer)} />
      </ShopReveal>
    </>
  );
}
