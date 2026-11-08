import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, safeReadData } from "@/lib/data/http/envelope";
import { z } from "zod";
import {
  type PartyDealDetail,
  type PartyDealRow,
  partyDealDetailSchema,
  partyDealRowSchema,
} from "./party-deals.schema";

/**
 * The private sales the signed-in person is named in, across their accounts. A read that fails
 * returns nothing: these rows sit beside purchases and consignments and must never take the page
 * down with them.
 */
export async function loadPartyDeals(): Promise<PartyDealRow[]> {
  try {
    const res = await authedServerFetch("/private-sales");
    if (!res.ok) return [];
    return readDataEnvelope(
      await readJsonBody(res),
      z.array(partyDealRowSchema),
      "GET /private-sales",
    );
  } catch {
    return [];
  }
}

/** One deal as the person's side may see it; null when it is not theirs or does not exist. */
export async function loadPartyDeal(reference: string): Promise<PartyDealDetail | null> {
  const res = await authedServerFetch(`/private-sales/${encodeURIComponent(reference)}`);
  return safeReadData(res, partyDealDetailSchema, {
    context: "GET /private-sales/:ref",
    nullStatuses: [404],
    notOkMessage: (status) => `Private sale unavailable: ${status}`,
  });
}
