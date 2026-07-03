import { z } from "zod";

export const venueFormSchema = z.object({
  legalEntityId: z.string(),
  name: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  county: z.string(),
  postcode: z.string(),
  country: z.string(),
  mapUrl: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string(),
  website: z.string(),
  photos: z.string(),
  capacity: z.string(),
  accessNotes: z.string(),
  parkingNotes: z.string(),
  directionsNotes: z.string(),
});

export type AdminVenueFormValues = z.infer<typeof venueFormSchema>;
