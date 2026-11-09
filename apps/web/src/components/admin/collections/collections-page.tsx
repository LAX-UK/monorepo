import {
  COLLECTIONS_PATH,
  type CollectionTab,
  DESK_TABS,
  collectionsHref,
} from "@/lib/admin/collections/collections.vm";
import type { DeskModel } from "@/lib/admin/collections/load-collections-page";
import {
  EmptyState,
  ErrorState,
  FormPage,
  Notice,
  StaffButtonLink,
  TabNav,
  ViewOnlyBadge,
} from "@auction/staff-ui";
import type { StaffCollectionSettings, StaffCollectionVenue } from "@auction/types";
import Link from "next/link";
import { ClosuresPanel } from "./closures-panel";
import { DeskDay } from "./desk-day";
import { DeskList } from "./desk-list";
import { HoursRulesForm } from "./hours-rules-form";

type Props = {
  tab: CollectionTab;
  venues: StaffCollectionVenue[];
  settings: StaffCollectionSettings | null;
  desk?: DeskModel | null;
  loadError: string | null;
  canChange: boolean;
  /** The London day. */
  today: string;
};

/**
 * Collections: who is coming to collect and when (Day, Upcoming, Not collected), and the hours,
 * rules and closures that decide when they can (Hours and rules, Closures).
 */
export function CollectionsPage({
  tab,
  venues,
  settings,
  desk,
  loadError,
  canChange,
  today,
}: Props) {
  const venueId = settings?.venueId ?? null;
  const tabs = (
    <TabNav
      label="Collections sections"
      Link={Link}
      items={[
        { id: "day", label: "Day", href: collectionsHref("day", venueId) },
        { id: "upcoming", label: "Upcoming", href: collectionsHref("upcoming", venueId) },
        {
          id: "not_collected",
          label: "Not collected",
          href: collectionsHref("not_collected", venueId),
          ...(desk?.missedCount ? { count: desk.missedCount } : {}),
        },
        {
          id: "hours",
          label: "Hours and rules",
          href: collectionsHref("hours", venueId),
        },
        {
          id: "closures",
          label: "Closures",
          href: collectionsHref("closures", venueId),
        },
      ]}
      activeId={tab}
    />
  );

  return (
    <FormPage
      title="Collections"
      description="Who is coming to collect, and when. Hand over after checking photo ID."
      tabs={tabs}
      notice={
        !canChange && settings ? (
          <div className="flex items-center gap-3">
            <ViewOnlyBadge />
            <span className="text-staff-sm text-staff-muted">
              Changing these settings is for the Fulfilment team.
            </span>
          </div>
        ) : null
      }
    >
      {loadError ? (
        <ErrorState
          title="Collections didn't load"
          description={loadError}
          action={
            <StaffButtonLink href={COLLECTIONS_PATH} variant="secondary" Link={Link}>
              Try again
            </StaffButtonLink>
          }
        />
      ) : !settings ? (
        <EmptyState
          title="No place to collect from"
          description="Collections are set up for a venue. Add a venue first, then come back to set its hours."
        />
      ) : (
        <>
          {venues.length > 1 ? (
            <VenueLinks venues={venues} current={settings.venueId} tab={tab} />
          ) : null}
          {settings.onlineBookingEnabled || DESK_TABS.includes(tab) ? null : (
            <Notice tone="info" title="Online booking is off">
              Clients can't book collections yet. Turn it on under Online booking when the hours are
              right.
            </Notice>
          )}
          {DESK_TABS.includes(tab) ? (
            desk?.error ? (
              <ErrorState
                title="The visits didn't load"
                description={desk.error}
                action={
                  <StaffButtonLink
                    href={collectionsHref(tab, venueId)}
                    variant="secondary"
                    Link={Link}
                  >
                    Try again
                  </StaffButtonLink>
                }
              />
            ) : desk?.day ? (
              <DeskDay day={desk.day} canChange={canChange} today={today} />
            ) : desk?.list ? (
              <DeskList list={desk.list} canChange={canChange} today={today} />
            ) : null
          ) : tab === "closures" ? (
            <ClosuresPanel
              key={settings.version}
              settings={settings}
              canChange={canChange}
              today={today}
            />
          ) : (
            <HoursRulesForm key={settings.version} settings={settings} canChange={canChange} />
          )}
        </>
      )}
    </FormPage>
  );
}

function VenueLinks({
  venues,
  current,
  tab,
}: {
  venues: StaffCollectionVenue[];
  current: string;
  tab: CollectionTab;
}) {
  return (
    <nav aria-label="Places" className="flex flex-wrap gap-2">
      {venues.map((venue) => (
        <Link
          key={venue.venueId}
          href={collectionsHref(tab, venue.venueId)}
          aria-current={venue.venueId === current ? "page" : undefined}
          className="rounded-staff-md border border-staff-line px-3 py-1.5 text-staff-sm text-staff-fg aria-[current=page]:border-staff-fg aria-[current=page]:font-medium"
        >
          {venue.name}
        </Link>
      ))}
    </nav>
  );
}
