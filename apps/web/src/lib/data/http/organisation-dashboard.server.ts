import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { DashboardFigures } from "@auction/domain";
import { z } from "zod";

const money = z.object({ currency: z.string(), amount: z.string() });
const date = z.coerce.date();

/** The figures the API sends; dates arrive as ISO strings. Unknown groups are dropped. */
const figuresSchema = z.object({
  consignmentProgress: z
    .object({
      under_review: z.number(),
      needs_changes: z.number(),
      accepted: z.number(),
      in_sale: z.number(),
      sold: z.number(),
      unsold: z.number(),
    })
    .optional(),
  upcomingSales: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        startsAt: date,
        works: z.number(),
        estimates: z.array(z.object({ currency: z.string(), low: z.string(), high: z.string() })),
      }),
    )
    .optional(),
  soldThisYear: z
    .object({ year: z.number(), works: z.number(), totals: z.array(money) })
    .optional(),
  payoutsDue: z
    .object({
      payouts: z.number(),
      totals: z.array(money),
      nextDate: date.nullable(),
      overdueSince: date.nullable(),
    })
    .optional(),
  openBids: z.object({ lots: z.number(), totalMax: z.array(money) }).optional(),
  purchasesToPay: z.object({ purchases: z.number(), totals: z.array(money) }).optional(),
});

/**
 * The business figures on the organisation's Home, in one request; `null` on failure so Home
 * keeps its tasks and activity without them.
 */
export async function getServerOrganisationDashboard(
  legalEntityId: string,
): Promise<DashboardFigures | null> {
  const res = await authedServerFetch("/legal-entities/home/dashboard", {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = figuresSchema.safeParse(body.data);
  if (!parsed.success) return null;
  // Optional keys are dropped when absent, so a group the role does not use stays absent.
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  ) as DashboardFigures;
}
