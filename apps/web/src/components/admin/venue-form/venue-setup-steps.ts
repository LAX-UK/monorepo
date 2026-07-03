import type { WizardStepSpec } from "@/components/admin/admin-form-wizard";
import type { AdminVenueFormValues } from "./venue-form-values";

export const VENUE_SETUP_STEPS = [
  { id: "location", label: "Location" },
  { id: "contact", label: "Contact" },
  { id: "notes", label: "Notes" },
] as const satisfies readonly WizardStepSpec[];

export const VENUE_STEP_FIELD_GROUPS: (readonly (keyof AdminVenueFormValues)[])[] = [
  ["name", "addressLine1", "addressLine2", "city", "county", "postcode", "country"],
  ["mapUrl", "latitude", "longitude", "contactPhone", "contactEmail", "website", "capacity"],
  ["accessNotes", "parkingNotes", "directionsNotes", "photos"],
];
