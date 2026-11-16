import {
  COLLECTIONS_PATH,
  COLLECTION_TAB_LABELS,
  type CollectionTab,
  DESK_TABS,
  collectionsHref,
} from "@/lib/admin/collections/collections.vm";
import type { DeskModel, StorageModel } from "@/lib/admin/collections/load-collections-page";
import { STORAGE_COPY } from "@/lib/admin/collections/storage-copy";
import {
  EmptyState,
  ErrorState,
  FormPage,
  Notice,
  StaffButtonLink,
  StatusBadge,
  TabNav,
  ViewOnlyBadge,
} from "@auction/staff-ui";
import type { StaffCollectionSettings, StaffCollectionVenue } from "@auction/types";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClosuresPanel } from "./closures-panel";
import { DeskBookForClientButton } from "./desk-book-for-client-button";
import { DeskDay } from "./desk-day";
import { DeskList } from "./desk-list";
import { HoursRulesForm } from "./hours-rules-form";
import { StoragePanel } from "./storage/storage-panel";

type Props = {
  tab: CollectionTab;
  /** The tabs this person sees, in order. */
  tabs: readonly CollectionTab[];
  venues: StaffCollectionVenue[];
  venueId: string | null;
  settings: StaffCollectionSettings | null;
  desk?: DeskModel | null;
  storage?: StorageModel | null;
  loadError: string | null;
  /** Fulfilment and Administrators: the visits, hours and closures. */
  canChange: boolean;
  /** Finance and Administrators: the storage terms and the charging switch. */
  canChangeStorage: boolean;
  /** The London day. */
  today: string;
};

/** The quiet line in the header for someone who may look but not change what the tab shows. */
function ViewOnly({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ViewOnlyBadge />
      <span className="text-staff-sm text-staff-muted">{children}</span>
    </div>
  );
}

/**
 * Collections: who is coming to collect and when (Day, Upcoming, Not collected), the hours, rules
 * and closures that decide when they can (Hours and rules, Closures), and what storage costs after
 * the free period (Storage). Each person sees the tabs their role can use.
 */
export function CollectionsPage({
  tab,
  tabs,
  venues,
  venueId,
  settings,
  desk,
  storage,
  loadError,
  canChange,
  canChangeStorage,
  today,
}: Props) {
  const onStorage = tab === "storage";
  const storageSettings = onStorage ? (storage?.settings ?? null) : null;
  const tabNav = (
    <TabNav
      label="Collections sections"
      Link={Link}
      items={tabs.map((id) => ({
        id,
        label: COLLECTION_TAB_LABELS[id],
        href: collectionsHref(id, venueId),
        ...(id === "not_collected" && desk?.missedCount ? { count: desk.missedCount } : {}),
      }))}
      activeId={tab}
    />
  );

  return (
    <FormPage
      title="Collections"
      description={
        onStorage
          ? STORAGE_COPY.pageDescription
          : "Who is coming to collect, and when. Hand over after checking photo ID."
      }
      tabs={tabNav}
      {...(storageSettings
        ? {
            status: storageSettings.charging.raiseInvoices ? (
              <StatusBadge tone="success">{STORAGE_COPY.status.on}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{STORAGE_COPY.status.off}</StatusBadge>
            ),
          }
        : {})}
      {...(canChange && settings && DESK_TABS.includes(tab)
        ? {
            primaryAction: <DeskBookForClientButton venueId={settings.venueId} today={today} />,
          }
        : {})}
      notice={
        onStorage ? (
          !canChangeStorage && storageSettings ? (
            <ViewOnly>{STORAGE_COPY.readOnly}</ViewOnly>
          ) : null
        ) : !canChange && settings ? (
          <ViewOnly>Changing these settings is for the Fulfilment team.</ViewOnly>
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
      ) : !venueId || (!onStorage && !settings) ? (
        <EmptyState
          title="No place to collect from"
          description="Collections are set up for a venue. Add a venue first, then come back to set its hours."
        />
      ) : (
        <>
          {venues.length > 1 ? <VenueLinks venues={venues} current={venueId} tab={tab} /> : null}
          {!settings ||
          settings.onlineBookingEnabled ||
          DESK_TABS.includes(tab) ||
          onStorage ? null : (
            <Notice tone="info" title="Online booking is off">
              Clients can't book collections yet. Turn it on under Online booking when the hours are
              right.
            </Notice>
          )}
          {onStorage ? (
            storage?.settings ? (
              <StoragePanel key={venueId} storage={storage.settings} canChange={canChangeStorage} />
            ) : (
              <ErrorState
                title={STORAGE_COPY.loadError.title}
                description={storage?.error ?? STORAGE_COPY.loadError.body}
                action={
                  <StaffButtonLink
                    href={collectionsHref("storage", venueId)}
                    variant="secondary"
                    Link={Link}
                  >
                    {STORAGE_COPY.loadError.action}
                  </StaffButtonLink>
                }
              />
            )
          ) : !settings ? null : DESK_TABS.includes(tab) ? (
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
