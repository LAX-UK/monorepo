import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData, safeReadData } from "@/lib/data/http/envelope";
import type {
  StaffCollectionChangeResult,
  StaffCollectionSettings,
  StaffCollectionVenue,
} from "@auction/types";
import { z } from "zod";

const PATH = "/admin/collections";

const time = z.string().nullable();

export const collectionVenueSchema: z.ZodType<StaffCollectionVenue> = z.object({
  venueId: z.string(),
  name: z.string(),
  hasPlace: z.boolean(),
  onlineBookingEnabled: z.boolean(),
});

const exceptionSchema = z.object({
  id: z.string().nullable(),
  kind: z.enum(["closure", "extra_opening"]),
  startsOn: z.string(),
  endsOn: z.string(),
  opensLocal: time,
  closesLocal: time,
  source: z.enum(["staff", "bank_holiday", "sale"]),
  reason: z.string().nullable(),
  saleTitle: z.string().nullable(),
  canRemove: z.boolean(),
});

export const collectionSettingsSchema: z.ZodType<StaffCollectionSettings> = z.object({
  venueId: z.string(),
  version: z.string(),
  onlineBookingEnabled: z.boolean(),
  bookingEmail: z.string().nullable(),
  visitMinutes: z.number(),
  placesPerSlot: z.number(),
  noticeCutoffLocal: z.string(),
  noticeWorkingDays: z.number(),
  windowDays: z.number(),
  closeOnSaleDays: z.boolean(),
  undoHandOverMinutes: z.number(),
  maxActiveVisits: z.number(),
  freeStorageDays: z.number().nullable(),
  storageChargePence: z.number().nullable(),
  hours: z.array(
    z.object({ weekday: z.number(), opensLocal: z.string(), closesLocal: z.string() }),
  ),
  exceptions: z.array(exceptionSchema),
  nextSaleDay: z.object({ saleTitle: z.string(), startsOn: z.string() }).nullable(),
});

export const collectionChangeSchema: z.ZodType<StaffCollectionChangeResult> = z.object({
  settings: collectionSettingsSchema,
  affected: z.array(
    z.object({
      bookingId: z.string(),
      reference: z.string(),
      start: z.string(),
      end: z.string(),
      reason: z.enum(["closed", "outside_hours", "over_capacity"]),
    }),
  ),
  cancelled: z.number(),
});

/** The places staff can set up; throws `forbidden` when the person may not look. */
export async function getCollectionVenues(): Promise<StaffCollectionVenue[]> {
  const res = await authedServerFetch(PATH);
  return readData(res, z.array(collectionVenueSchema), {
    context: "GET /admin/collections",
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Collections unavailable: ${status}`),
  });
}

/** One place's settings, hours and closures; null when it does not exist. */
export async function getCollectionSettings(
  venueId: string,
): Promise<StaffCollectionSettings | null> {
  const res = await authedServerFetch(`${PATH}/${encodeURIComponent(venueId)}`);
  return safeReadData(res, collectionSettingsSchema, {
    context: "GET /admin/collections/:venueId",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Collections unavailable: ${status}`),
  });
}
