import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type SellerReofferView, sellerReofferViewSchema } from "@auction/validators";
import { z } from "zod";

/**
 * The requests to re-offer a lot after its buyer did not pay, as the acting seller account reads
 * them (`/legal-entities/reoffer-requests`). The API shows an account only its own requests and
 * answers a member whose role cannot see them with a refusal: that is an answer, not a fault.
 */

export type SellerReofferLoad =
  | { kind: "ok"; view: SellerReofferView }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "error" };

/** One request; each way it can not be shown is its own answer, so the page says which. */
export async function loadSellerReoffer(reofferId: string): Promise<SellerReofferLoad> {
  try {
    const res = await authedServerFetch(
      `/legal-entities/reoffer-requests/${encodeURIComponent(reofferId)}`,
    );
    if (res.status === 404) return { kind: "not_found" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error" };
    const view = readDataEnvelope(
      await readJsonBody(res),
      sellerReofferViewSchema,
      "GET /legal-entities/reoffer-requests/:id",
    );
    return { kind: "ok", view };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Every request of the account, newest first. A list that cannot be read returns nothing: it
 * sits beside the sold lots and must never take that page down with it.
 */
export async function listSellerReoffers(): Promise<SellerReofferView[]> {
  try {
    const res = await authedServerFetch("/legal-entities/reoffer-requests");
    if (!res.ok) return [];
    return readDataEnvelope(
      await readJsonBody(res),
      z.array(sellerReofferViewSchema),
      "GET /legal-entities/reoffer-requests",
    );
  } catch {
    return [];
  }
}
