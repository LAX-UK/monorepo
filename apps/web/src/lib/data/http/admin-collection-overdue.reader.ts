import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData } from "@/lib/data/http/envelope";
import type { StaffOverdueLots } from "@auction/types";
import { z } from "zod";

export const overdueLotsSchema: z.ZodType<StaffOverdueLots> = z.object({
  venueId: z.string(),
  today: z.string(),
  chargingOn: z.boolean(),
  more: z.boolean(),
  total: z.number(),
  lots: z.array(
    z.object({
      lotId: z.string(),
      lotNumber: z.number().nullable(),
      title: z.string(),
      buyerName: z.string(),
      collectBy: z.string(),
      daysOver: z.number(),
      band: z.enum(["standard", "large"]),
      amountPence: z.number(),
      amountDetail: z.string().nullable(),
      extensionDays: z.number(),
      extensionDaysLeft: z.number(),
      waived: z.boolean(),
      followUp: z.boolean(),
      legacyTerms: z.boolean(),
    }),
  ),
});

/** The lots past their collect-by day at a place; throws when the API refuses or is unreachable. */
export async function getOverdueLots(venueId: string): Promise<StaffOverdueLots> {
  const res = await authedServerFetch(
    `/admin/collections/${encodeURIComponent(venueId)}/storage/overdue`,
  );
  return readData(res, overdueLotsSchema, {
    context: "GET /admin/collections/:venueId/storage/overdue",
    notOkMessage: (status) =>
      status === 403 ? "forbidden" : `Lots past collect-by unavailable: ${status}`,
  });
}
