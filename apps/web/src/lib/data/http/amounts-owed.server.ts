import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { AmountOwedEntry } from "@auction/domain";
import { z } from "zod";

/** What the acting account owes, lot by lot: the one reading every money figure is drawn from. */
export type AmountsOwedView = { entries: AmountOwedEntry[] };

const entrySchema = z.object({
  lotId: z.string(),
  state: z.enum(["payment-due", "in-review", "cancelled"]),
  role: z.enum(["payer", "informed", "none"]),
  amountDue: z.string().nullable(),
  currency: z.string(),
  blocker: z.enum(["documents", "review"]).nullable(),
}) satisfies z.ZodType<AmountOwedEntry, z.ZodTypeDef, unknown>;

const viewSchema = z.object({ entries: z.array(entrySchema) });

/**
 * Reads the amounts owed for the person's own account, or for the organisation named. The API
 * answers for the account it is told about, and refuses roles that do not follow its purchases.
 */
export async function getServerAmountsOwed(accountId?: string): Promise<AmountsOwedView> {
  const res = await authedServerFetch("/users/me/account/amounts-owed", {
    cache: "no-store",
    ...(accountId ? { headers: { [X_LEGAL_ENTITY_ID_HEADER]: accountId } } : {}),
  });
  await throwIfNotOk(res, "portfolio");
  return readDataEnvelope(
    await readJsonBody(res),
    viewSchema,
    "GET /users/me/account/amounts-owed",
  );
}
