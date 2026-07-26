import { AdminVenueForm } from "@/components/admin/venue-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { Venue } from "@auction/types";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminFormWizardProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/admin-form-wizard", () => ({
  AdminFormWizard: (props: Record<string, unknown>) => {
    adminFormWizardProps.push(props);
    return <div data-testid="admin-form-wizard" />;
  },
}));

vi.mock("@/components/admin/form-dirty-guard", () => ({
  FormDirtyGuard: () => null,
}));

vi.mock("@/components/admin/use-guarded-navigation", () => ({
  useGuardedNavigation: () => ({ guardedPush: vi.fn() }),
}));

vi.mock("@/components/admin/catalog/use-catalog-form-submit", () => ({
  useCatalogValidationBanner: () => ({
    validationBanner: null,
    validationStepIndex: null,
    setValidationFailure: vi.fn(),
    clearValidationBanner: vi.fn(),
    notifyValidationFailure: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./steps/contact-step", () => ({
  VenueContactStep: () => <div>Contact step</div>,
}));

vi.mock("./steps/location-step", () => ({
  VenueLocationStep: () => <div>Location step</div>,
}));

vi.mock("./steps/notes-step", () => ({
  VenueNotesStep: () => <div>Notes step</div>,
}));

const venue: Venue = {
  id: "venue-1",
  legalEntityId: "le-1",
  name: "LAX Mayfair Saleroom",
  slug: "lax-mayfair-saleroom",
  addressLine1: "12 King Street",
  addressLine2: null,
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

describe("AdminVenueForm wizard presentation", () => {
  it("keeps horizontal layout defaults for legacy flows", () => {
    adminFormWizardProps.length = 0;

    render(<AdminVenueForm mode="create" platformLegalEntityId="le-1" />);

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "default",
      hideStickyOnMobile: false,
      showSubmitOnAllSteps: false,
    });
  });

  it("uses sidebar layout with edit save visibility and suppressed mobile sticky actions", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminVenueForm
        mode="edit"
        venue={venue}
        htmlFormId={CATALOG_FORM_IDS.venue}
        wizardLayout="sidebar"
        cancelHref="/admin/venues/venue-1"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: true,
      showSubmitOnAllSteps: true,
    });
  });

  it("uses sidebar layout for full-page create with suppressed mobile sticky actions", () => {
    adminFormWizardProps.length = 0;

    render(
      <AdminVenueForm
        mode="create"
        platformLegalEntityId="le-1"
        htmlFormId={CATALOG_FORM_IDS.venue}
        wizardLayout="sidebar"
      />,
    );

    expect(adminFormWizardProps.at(-1)).toMatchObject({
      layout: "sidebar",
      hideStickyOnMobile: true,
      showSubmitOnAllSteps: false,
    });
  });
});
