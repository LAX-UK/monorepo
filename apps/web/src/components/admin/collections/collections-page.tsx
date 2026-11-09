import {
  COLLECTIONS_PATH,
  type CollectionTab,
  collectionsHref,
} from "@/lib/admin/collections/collections.vm";
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
import { HoursRulesForm } from "./hours-rules-form";

type Props = {
  tab: CollectionTab;
  venues: StaffCollectionVenue[];
  settings: StaffCollectionSettings | null;
  loadError: string | null;
  canChange: boolean;
  /** The London day. */
  today: string;
};

/**
 * Collections: the hours and rules for collecting purchased works, and the days the gallery is
 * closed. Two tabs, "Hours and rules" and "Closures"; the day's visits arrive with the next
 * release of this page.
 */
export function CollectionsPage({ tab, venues, settings, loadError, canChange, today }: Props) {
  const venueId = settings?.venueId ?? null;
  const tabs = (
    <TabNav
      label="Collections sections"
      Link={Link}
      items={[
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
      description="When clients can collect their purchased works, how many at a time, and the days the gallery is closed."
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
          {settings.onlineBookingEnabled ? null : (
            <Notice tone="info" title="Online booking is off">
              Clients can't book collections yet. Turn it on under Online booking when the hours are
              right.
            </Notice>
          )}
          {tab === "closures" ? (
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
