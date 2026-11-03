import { MarketingSection } from "@/components/marketing/marketing-section";
import { visibleHomeSections } from "@/lib/home-sections/build-home-sections";
import type { HomeLotRail, HomeSections } from "@/lib/home-sections/types";
import type { CoverAlertsOutcome } from "@/lib/marketing-cover/cover-alerts-outcome";
import type { HomeSectionId, HomeState, HomeStateResult } from "@auction/domain";
import type { ReactNode } from "react";
import { HomeAlertsBand } from "./home-alerts-band";
import { HomeArtistsSection } from "./home-artists";
import { HomeComingUpSection } from "./home-coming-up";
import { HomeDepartmentsSection } from "./home-departments";
import { HomeLotGrid, type HomeLotWatch } from "./home-lot-grid";
import { HomePressSection } from "./home-press";
import { HomeResultsBandSection } from "./home-results-band";
import { HomeSellingBand } from "./home-selling-band";

type Render<K extends HomeSectionId> = (
  value: NonNullable<HomeSections[K]>,
  state: HomeState,
  watch: HomeLotWatch,
  alertsOutcome: CoverAlertsOutcome | null,
) => ReactNode;

function lotRail(id: string) {
  return (rail: HomeLotRail, _state: HomeState, watch: HomeLotWatch): ReactNode => (
    <MarketingSection
      id={`home-${id}`}
      heading={rail.heading}
      subtitle={rail.subtitle}
      action={rail.seeAll}
    >
      <HomeLotGrid lots={rail.lots} label={rail.heading} watch={watch} />
    </MarketingSection>
  );
}

/** One renderer per section, so a new section is a new entry here and in the builders. */
const RENDERERS: { [K in HomeSectionId]: Render<K> } = {
  inThisSale: lotRail("in-this-sale"),
  highlightsFromNextSale: lotRail("next-sale"),
  topLotsOfSale: lotRail("top-lots"),
  comingUp: (comingUp) => <HomeComingUpSection comingUp={comingUp} />,
  recentResults: (band, _state, watch) => <HomeResultsBandSection band={band} watch={watch} />,
  departments: (departments) => <HomeDepartmentsSection departments={departments} />,
  artists: (artists) => <HomeArtistsSection artists={artists} />,
  selling: (selling) => <HomeSellingBand selling={selling} />,
  alerts: (_, _state, watch, alertsOutcome) => (
    <HomeAlertsBand signedIn={watch.isAuthenticated} outcome={alertsOutcome} />
  ),
  fromLaxAndPress: (items) => <HomePressSection items={items} />,
};

/**
 * The sections under the hang, in the order of the home state. A section with nothing to show
 * has no entry in `sections` and so is not drawn: it is removed, never emptied.
 */
export function HomeSectionsView({
  homeState,
  sections,
  watch,
  alertsOutcome = null,
}: {
  homeState: HomeStateResult;
  sections: HomeSections;
  watch: HomeLotWatch;
  /** The outcome of a sale-alerts sign-up posted from this page, shown in the alerts band. */
  alertsOutcome?: CoverAlertsOutcome | null;
}) {
  const visible = visibleHomeSections(homeState, sections);
  if (visible.length === 0) return null;
  return (
    <div className="pb-16 md:pb-24">
      {visible.map((id) => {
        const render = RENDERERS[id] as Render<HomeSectionId>;
        return (
          <div key={id} data-home-section={id}>
            {render(
              sections[id] as NonNullable<HomeSections[HomeSectionId]>,
              homeState.state,
              watch,
              alertsOutcome,
            )}
          </div>
        );
      })}
    </div>
  );
}
