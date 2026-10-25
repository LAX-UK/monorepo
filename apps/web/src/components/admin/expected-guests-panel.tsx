"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import {
  type DataColumn,
  DataTableToolbar,
  PersonCell,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  TableSearch,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { OnsiteEventSegmentOption, SaleDeliveryMode } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";
import { guestReadiness, guestSaleStatus, segmentLabel } from "./expected-guests/guest-helpers";
import { useExpectedGuestActions } from "./expected-guests/use-expected-guest-actions";
import { useExpectedGuestsSearch } from "./expected-guests/use-expected-guests";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  eventSlug: string;
  eventTitle: string;
  segmentOptions: OnsiteEventSegmentOption[];
  items: AdminExpectedGuestRow[];
};

/** RSVP guests for the sale's event, with who has arrived and who holds a paddle. */
export function ExpectedGuestsPanel({
  saleId,
  deliveryMode,
  eventSlug,
  eventTitle,
  segmentOptions,
  items,
}: Props) {
  const { search, setSearch, filtered, stats } = useExpectedGuestsSearch(items, segmentOptions);
  const { actionsFor, dialogs } = useExpectedGuestActions(saleId, deliveryMode);

  const columns = useMemo<DataColumn<AdminExpectedGuestRow>[]>(
    () => [
      {
        id: "guest",
        header: "Guest",
        mobile: "title",
        sortable: true,
        sortValue: (guest) => (guest.name ?? guest.email).toLowerCase(),
        cell: (guest) => (
          <PersonCell
            name={guest.name ?? guest.email}
            secondary={guest.name ? guest.email : null}
            href={`/admin/clients/${encodeURIComponent(guest.userId)}`}
            Link={NextLink}
          />
        ),
      },
      {
        id: "attendance",
        header: "Attending",
        width: "160px",
        hideBelow: "md",
        mobile: "meta",
        sortable: true,
        sortValue: (guest) => segmentLabel(segmentOptions, guest.attendanceSegment).toLowerCase(),
        cell: (guest) => segmentLabel(segmentOptions, guest.attendanceSegment),
      },
      {
        id: "gala",
        header: "Gala arrival",
        width: "168px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (guest) => <StaffDate value={guest.galaCheckedInAt} withTime />,
      },
      {
        id: "readiness",
        header: "Account",
        width: "200px",
        mobile: "meta",
        truncate: false,
        cell: (guest) => {
          const status = guestReadiness(guest);
          return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
        },
      },
      {
        id: "sale",
        header: "At this sale",
        width: "144px",
        mobile: "badge",
        truncate: false,
        cell: (guest) => {
          const status = guestSaleStatus(guest);
          return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
        },
      },
      rowActionsColumn<AdminExpectedGuestRow>({
        actions: actionsFor,
        label: (guest) => `Actions for ${guest.name ?? guest.email}`,
        Link: NextLink,
      }),
    ],
    [actionsFor, segmentOptions],
  );

  return (
    <>
      <RelatedRecordsSection
        id="expected-guests"
        title="Expected guests"
        description={
          <>
            RSVPs from{" "}
            <NextLink
              href={`/admin/event-rsvps/${encodeURIComponent(eventSlug)}`}
              className="underline underline-offset-2"
            >
              {eventTitle}
            </NextLink>
            : {items.length} expected, {stats.galaCheckedIn} at the gala, {stats.salePresent}{" "}
            present, {stats.paddled} with a paddle.
          </>
        }
        label="Expected guests"
        columns={columns}
        data={filtered}
        getRowId={(guest) => guest.rsvpId}
        defaultSort={{ columnId: "guest", direction: "asc" }}
        density="comfortable"
        toolbar={
          <DataTableToolbar
            search={
              <TableSearch
                live
                label="Search expected guests"
                placeholder="Name, email or attendance"
                value={search}
                onSearch={setSearch}
              />
            }
          />
        }
        empty={{
          title: "No matching guests",
          description: "Try a different name or email.",
        }}
      />
      {dialogs}
    </>
  );
}
