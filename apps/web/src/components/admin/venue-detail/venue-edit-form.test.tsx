import { VenueEditForm } from "@/components/admin/venue-detail/venue-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Venue } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminVenueFormProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/venue-form", () => ({
  AdminVenueForm: (props: Record<string, unknown>) => {
    adminVenueFormProps.push(props);
    return <div data-testid="admin-venue-form" />;
  },
}));

const venue: Venue = {
  id: "venue-1",
  legalEntityId: "le-1",
  name: "LAX Mayfair Saleroom",
  slug: "lax-mayfair-saleroom",
  addressLine1: "12 King Street",
  addressLine2: "St James's",
  city: "London",
  county: null,
  postcode: "SW1Y 6QU",
  country: "United Kingdom",
  mapUrl: null,
  latitude: null,
  longitude: null,
  openingHours: null,
  contactPhone: null,
  contactEmail: null,
  website: null,
  photos: [],
  capacity: null,
  accessNotes: null,
  parkingNotes: null,
  directionsNotes: null,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("VenueEditForm", () => {
  it("renders sidebar wizard edit form with external submit id and cancel href", () => {
    adminVenueFormProps.length = 0;

    render(
      <VenueEditForm
        venue={venue}
        legalEntityDisplayName="LAX Stock"
        salesUsingCount={0}
        cancelHref="/admin/venues/venue-1"
      />,
    );

    expect(screen.getByTestId("admin-venue-form")).toBeInTheDocument();
    expect(adminVenueFormProps.at(-1)).toMatchObject({
      mode: "edit",
      htmlFormId: CATALOG_FORM_IDS.venue,
      wizardLayout: "sidebar",
      cancelHref: "/admin/venues/venue-1",
    });
  });
});
