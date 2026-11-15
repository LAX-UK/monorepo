import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData } from "@/lib/data/http/envelope";
import type { StaffStorageSettings } from "@auction/types";
import { z } from "zod";

const terms = z.object({
  id: z.string(),
  effectiveFrom: z.string(),
  freeDays: z.number(),
  countMode: z.enum(["calendar", "working"]),
  standardDailyPence: z.number(),
  largeDailyPence: z.number().nullable(),
  handlingFeePence: z.number(),
  reason: z.string(),
});

const values = z.record(z.unknown()).nullable();

export const storageSettingsSchema: z.ZodType<StaffStorageSettings> = z.object({
  venueId: z.string(),
  today: z.string(),
  inForce: terms.nullable(),
  scheduled: terms.nullable(),
  charging: z.object({
    raiseInvoices: z.boolean(),
    vatTreatment: z.enum(["standard_rated", "zero_rated", "exempt", "outside_scope"]).nullable(),
  }),
  history: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      action: z.enum([
        "terms_scheduled",
        "terms_edited",
        "terms_cancelled",
        "charging_switched",
        "vat_treatment_set",
        "terms_migrated",
      ]),
      who: z.string().nullable(),
      before: values,
      after: values,
      reason: z.string().nullable(),
    }),
  ),
});

/** A place's storage terms, switch and history; throws when the API refuses or is unreachable. */
export async function getCollectionStorage(venueId: string): Promise<StaffStorageSettings> {
  const res = await authedServerFetch(`/admin/collections/${encodeURIComponent(venueId)}/storage`);
  return readData(res, storageSettingsSchema, {
    context: "GET /admin/collections/:venueId/storage",
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Storage unavailable: ${status}`),
  });
}
