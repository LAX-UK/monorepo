import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { HomeSectionToolbar } from "@/components/marketing/home-section-toolbar";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { catalogViewCarryParams, lotCatalogHref } from "@/lib/marketing/catalog-links";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { cn } from "@auction/ui";
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

function urgencyLotHref(item: LotCardVM, layoutView: CatalogLayoutView): string {
  return lotCatalogHref(
    { id: item.id, title: item.title },
    catalogViewCarryParams(urgencySwitcherValue(layoutView)),
  );
}

function urgencyCountLabel(count: number): string {
  if (count === 1) return "1 lot";
  return `${count} lots`;
}

function UrgencySectionHeader({ variant }: { variant: UrgencySectionVariant }) {
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
        <Button variant="chevron" asChild>
          <Link href={c.viewAllHref} className="inline-flex items-center gap-[11px] py-[18px]">
            <span className="text-center text-base font-semibold leading-6 tracking-[0.05em] text-on-surface">
              View all
            </span>
            <span className="sr-only"> {c.srAction}</span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </Button>
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
  const headingId = COPY[variant].headingId;
  const switcherValue = urgencySwitcherValue(layoutView);
  const isList = switcherValue === "list";

  if (items.length === 0) {
    return (
      <section
        aria-labelledby={headingId}
        className={cn("cv-auto", MARKETING_PAGE_SHELL, "pt-[var(--section-spacing-tight)]")}
      >
        <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-8">
          <UrgencySectionHeader variant={variant} />
          <MarketingEmptyState
            variant="marketing"
            title={`No ${COPY[variant].heading.toLowerCase()} right now`}
            description="Check back soon or browse the full catalogue."
            action={
              <Button variant="outline" asChild>
                <Link href={COPY[variant].viewAllHref}>View catalogue</Link>
              </Button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn("cv-auto", MARKETING_PAGE_SHELL, "pt-[var(--section-spacing-tight)]")}
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-8">
        <UrgencySectionHeader variant={variant} />
        <HomeSectionToolbar
          countLabel={urgencyCountLabel(items.length)}
          trailing={
            <CatalogViewSwitcher
              routeKey="home-urgency"
              value={switcherValue}
              supportedModes={["grid", "list"]}
            />
          }
        />
        {isList ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <UrgencyLotRow
                  variant={variant}
                  item={{ ...item, href: urgencyLotHref(item, layoutView) }}
                  isAuthenticated={isAuthenticated}
                  watchedLotIds={watchedLotIds}
                  loginNextPath={loginNextPath}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-4 lg:gap-8">
            {items.map((item, index) => (
              <UrgencyLotCard
                key={item.id}
                item={{ ...item, href: urgencyLotHref(item, layoutView) }}
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
