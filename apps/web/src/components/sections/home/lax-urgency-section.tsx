import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { UrgencyLotCard } from "./urgency-lot-card";
import { UrgencyLotRow } from "./urgency-lot-row";

export type UrgencySectionVariant = "endingSoon" | "liveNow" | "upcoming";

type Props = {
  variant: UrgencySectionVariant;
  items: LotCardVM[];
  layoutView: CatalogLayoutView;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

const COPY = {
  endingSoon: {
    heading: "Ending Soon",
    viewAllHref: "/search?ending=24h",
    headingId: "home-ending-soon-heading",
    srAction: "lots ending in the next 24 hours",
  },
  liveNow: {
    heading: "Live Now",
    viewAllHref: "/search?status=active",
    headingId: "home-live-now-heading",
    srAction: "live lots accepting bids",
  },
  upcoming: {
    heading: "Upcoming Lots",
    viewAllHref: "/search?status=scheduled",
    headingId: "home-upcoming-lots-heading",
    srAction: "lots scheduled to open soon",
  },
} as const;

function urgencySwitcherValue(v: CatalogLayoutView): CatalogLayoutView {
  return v === "list" ? "list" : "grid";
}

function UrgencySectionHeader({
  variant,
  switcherValue,
}: {
  variant: UrgencySectionVariant;
  switcherValue: CatalogLayoutView;
}) {
  const c = COPY[variant];
  return (
    <MarketingSectionHeader
      heading={
        <DisplayHeading
          as="h2"
          id={c.headingId}
          size="section"
          className="font-semibold text-on-surface"
        >
          {c.heading}
        </DisplayHeading>
      }
      action={
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <CatalogViewSwitcher
            routeKey="home-urgency"
            value={switcherValue}
            supportedModes={["grid", "list"]}
          />
          <Button variant="chevron" asChild>
            <Link href={c.viewAllHref} className="inline-flex items-center gap-[11px] py-[18px]">
              <span className="text-center text-base font-semibold leading-6 tracking-[0.05em] text-on-surface">
                View all
              </span>
              <span className="sr-only"> {c.srAction}</span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </Link>
          </Button>
        </div>
      }
    />
  );
}

/**
 * Urgency strip after the hero: “Ending Soon” (lots ending within 24h), else “Live Now”
 * when active lots exist, else “Upcoming Lots” from scheduled inventory. Data shaping lives in `getHomeData`.
 */
export function LaxUrgencySection({
  variant,
  items,
  layoutView,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  if (items.length === 0) return null;

  const headingId = COPY[variant].headingId;
  const switcherValue = urgencySwitcherValue(layoutView);
  const isList = switcherValue === "list";

  return (
    <section
      aria-labelledby={headingId}
      className="cv-auto mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pt-10 md:px-10 lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <UrgencySectionHeader variant={variant} switcherValue={switcherValue} />
        {isList ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <UrgencyLotRow
                  variant={variant}
                  item={item}
                  isAuthenticated={isAuthenticated}
                  watchedLotIds={watchedLotIds}
                  loginNextPath={loginNextPath}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4 lg:gap-8">
            {items.map((item, index) => (
              <UrgencyLotCard
                key={item.id}
                item={item}
                index={index}
                isAuthenticated={isAuthenticated}
                watchedLotIds={watchedLotIds}
                loginNextPath={loginNextPath}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
