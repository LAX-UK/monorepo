import { visibleHomeSections } from "@/lib/home-sections/build-home-sections";
import type { HomeLotRail, HomeSections } from "@/lib/home-sections/types";
import type { HomeSectionId, HomeState, HomeStateResult } from "@auction/domain";
import type { ReactNode } from "react";
import { HomeAlertsBand } from "./home-alerts-band";
import { HomeArtistsSection } from "./home-artists";
import { HomeComingUpSection } from "./home-coming-up";
import { HomeDepartmentsSection } from "./home-departments";
import { HomeLotGrid } from "./home-lot-grid";
import { HomePressSection } from "./home-press";
import { HomeResultsBandSection } from "./home-results-band";
import { HomeSection } from "./home-section";
import { HomeSellingBand } from "./home-selling-band";

type Render<K extends HomeSectionId> = (
  value: NonNullable<HomeSections[K]>,
  state: HomeState,
) => ReactNode;

function lotRail(id: string) {
  return (rail: HomeLotRail): ReactNode => (
    <HomeSection id={id} heading={rail.heading} subtitle={rail.subtitle} action={rail.seeAll}>
      <HomeLotGrid lots={rail.lots} label={rail.heading} />
    </HomeSection>
  );
}

/** One renderer per section, so a new section is a new entry here and in the builders. */
const RENDERERS: { [K in HomeSectionId]: Render<K> } = {
  inThisSale: lotRail("in-this-sale"),
  highlightsFromNextSale: lotRail("next-sale"),
  topLotsOfSale: lotRail("top-lots"),
  comingUp: (comingUp) => <HomeComingUpSection comingUp={comingUp} />,
  recentResults: (band) => <HomeResultsBandSection band={band} />,
  departments: (departments) => <HomeDepartmentsSection departments={departments} />,
  artists: (artists) => <HomeArtistsSection artists={artists} />,
  selling: (selling) => <HomeSellingBand selling={selling} />,
  alerts: (_, state) => <HomeAlertsBand state={state} />,
  fromLaxAndPress: (items) => <HomePressSection items={items} />,
};

/**
 * The sections under the hang, in the order of the home state. A section with nothing to show
 * has no entry in `sections` and so is not drawn: it is removed, never emptied.
 */
export function HomeSectionsView({
  homeState,
  sections,
}: {
  homeState: HomeStateResult;
  sections: HomeSections;
}) {
  const visible = visibleHomeSections(homeState, sections);
  if (visible.length === 0) return null;
  return (
    <div className="pb-16 md:pb-24">
      {visible.map((id) => {
        const render = RENDERERS[id] as Render<HomeSectionId>;
        return (
          <div key={id} data-home-section={id}>
            {render(sections[id] as NonNullable<HomeSections[HomeSectionId]>, homeState.state)}
          </div>
        );
      })}
    </div>
  );
}
