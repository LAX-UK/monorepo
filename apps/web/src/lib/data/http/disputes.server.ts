import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { z } from "zod";

const disputeOpenCountSchema = z.object({ count: z.coerce.number().optional() });

/** Finance admin: count of open dispute cases for nav badges. */
export async function getAdminDisputeOpenCount(): Promise<number> {
  const res = await authedServerFetch("/admin/finance/disputes/open-count");
  if (!res.ok) throw new Error(`Failed to load dispute open count: ${res.status}`);
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(
    body,
    disputeOpenCountSchema,
    "GET /admin/finance/disputes/open-count",
  );
  return Number(parsed.count ?? 0);
}
