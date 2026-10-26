"use client";

import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";
import {
  DetailColumns,
  type KeyValueItem,
  KeyValueList,
  Section,
  StaffDate,
  type StaffLinkComponent,
  TextLink,
} from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  venueId: string;
  detail: VenueDetail;
};

/** Rows with a value only: a missing fact is simply not listed. */
function present(items: Array<KeyValueItem | null>): KeyValueItem[] {
  return items.filter((item): item is KeyValueItem => item !== null);
}

function note(label: string, value: string | null): KeyValueItem | null {
  return value?.trim()
    ? { label, value: <span className="whitespace-pre-line">{value}</span> }
    : null;
}

/**
 * The venue at a glance: where it is, how to reach it, how many sales use it and what visitors
 * need to know; the record's web address and dates in the rail.
 */
export function VenueOverviewTab({ venueId, detail }: Props) {
  const { venue, salesUsingCount } = detail;
  const address = [
    venue.addressLine1,
    venue.addressLine2,
    [venue.city, venue.county].filter(Boolean).join(", "),
    venue.postcode,
    venue.country,
  ].filter((line): line is string => Boolean(line?.trim()));

  const contact = present([
    venue.contactPhone ? { label: "Phone", value: venue.contactPhone } : null,
    venue.contactEmail
      ? {
          label: "Email",
          value: <TextLink href={`mailto:${venue.contactEmail}`}>{venue.contactEmail}</TextLink>,
        }
      : null,
    venue.website
      ? {
          label: "Website",
          value: (
            <TextLink href={venue.website} external>
              {venue.website}
            </TextLink>
          ),
        }
      : null,
  ]);

  const location = present([
    venue.mapUrl
      ? {
          label: "Map",
          value: (
            <TextLink href={venue.mapUrl} external>
              View on map
            </TextLink>
          ),
        }
      : null,
    venue.latitude != null && venue.longitude != null
      ? {
          label: "Coordinates",
          value: `${venue.latitude}, ${venue.longitude}`,
          numeric: true,
        }
      : null,
    venue.capacity != null
      ? { label: "Capacity", value: String(venue.capacity), numeric: true }
      : null,
  ]);

  const visitors = present([
    note("Access", venue.accessNotes),
    note("Parking", venue.parkingNotes),
    note("Directions", venue.directionsNotes),
  ]);

  const rail = (
    <Section title="Record">
      <KeyValueList
        items={[
          { label: "Venue ID", value: venue.id, copyValue: venue.id },
          ...(venue.slug
            ? [{ label: "Web address", value: <span className="font-mono">/{venue.slug}</span> }]
            : []),
          { label: "Created", value: <StaffDate value={venue.createdAt} withTime /> },
          { label: "Updated", value: <StaffDate value={venue.updatedAt} withTime /> },
        ]}
      />
    </Section>
  );

  return (
    <DetailColumns rail={rail} railLabel="Venue record">
      <Section title="Address">
        <KeyValueList
          items={[
            {
              label: "Address",
              value: (
                <span className="flex flex-col">
                  {address.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              ),
            },
          ]}
        />
      </Section>
      <Section
        title="Usage"
        description="Venues can only be used by sales run by the same organisation."
      >
        <KeyValueList
          items={[
            {
              label: "Sales",
              value:
                salesUsingCount > 0 ? (
                  <span className="flex flex-wrap items-center gap-x-2">
                    {salesUsingCount} {salesUsingCount === 1 ? "sale uses" : "sales use"} this venue
                    <TextLink Link={NextLink} href={`/admin/venues/${venueId}/sales`}>
                      View
                    </TextLink>
                  </span>
                ) : (
                  "No sales use this venue yet"
                ),
            },
          ]}
        />
      </Section>
      {contact.length > 0 ? (
        <Section title="Contact">
          <KeyValueList items={contact} />
        </Section>
      ) : null}
      {location.length > 0 ? (
        <Section title="Location">
          <KeyValueList items={location} />
        </Section>
      ) : null}
      {visitors.length > 0 ? (
        <Section title="Visitor information">
          <KeyValueList items={visitors} />
        </Section>
      ) : null}
    </DetailColumns>
  );
}
