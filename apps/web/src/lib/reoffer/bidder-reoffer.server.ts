import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type BidderReofferView, bidderReofferViewSchema } from "@auction/validators";
import { z } from "zod";

/**
 * The offers made to the acting account after a buyer did not pay (`/legal-entities/reoffers`).
 * The API shows an account only the offers it was made and only once it was told, so another
 * account's offer is "not found" and a role that cannot see offers is refused: each is an answer,
 * not a fault.
 */

export type BidderReofferLoad =
  | { kind: "ok"; view: BidderReofferView }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "error" };

/** One offer; each way it can not be shown is its own answer, so the page says which. */
export async function loadBidderReoffer(reofferId: string): Promise<BidderReofferLoad> {
  try {
    const res = await authedServerFetch(
      `/legal-entities/reoffers/${encodeURIComponent(reofferId)}`,
    );
    if (res.status === 404) return { kind: "not_found" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error" };
    const view = readDataEnvelope(
      await readJsonBody(res),
      bidderReofferViewSchema,
      "GET /legal-entities/reoffers/:id",
    );
    return { kind: "ok", view };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Every offer of the account, newest first. A list that cannot be read returns nothing: it sits
 * above the bids and a purchase and must never take those pages down with it.
 */
export async function listBidderReoffers(): Promise<BidderReofferView[]> {
  try {
    const res = await authedServerFetch("/legal-entities/reoffers");
    if (!res.ok) return [];
    return readDataEnvelope(
      await readJsonBody(res),
      z.array(bidderReofferViewSchema),
      "GET /legal-entities/reoffers",
    );
  } catch {
    return [];
  }
}

/**
 * When a purchase was bought by accepting an offer after the auction, the day it was accepted;
 * otherwise `null`. A purchase page says so on its subtitle instead of "won", since nothing was
 * won at the sale. Read apart from the purchase, so a failure only leaves the plain subtitle.
 */
export async function reofferBoughtOn(lotId: string): Promise<string | null> {
  const offers = await listBidderReoffers();
  const accepted = offers.find((offer) => offer.lotId === lotId && offer.status === "accepted");
  return accepted?.respondedAt ?? null;
}
