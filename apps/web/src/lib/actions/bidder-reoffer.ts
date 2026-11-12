"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  REOFFER_UNAVAILABLE,
  bidderReofferErrorMessage,
} from "@/lib/reoffer/bidder-reoffer-errors";
import { bidderReofferHref } from "@/lib/reoffer/bidder-reoffer-links";
import {
  acceptReofferBodySchema,
  declineReofferBodySchema,
  reofferIdParamSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";

async function failure(res: Response): Promise<ActionResult<never>> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const code = typeof body?.error === "string" ? body.error : undefined;
  return actionFailure(bidderReofferErrorMessage(code), undefined, res.status, code);
}

/** What changes on the pages that list or follow an offer once it is answered. */
function revalidateOffer(reofferId: string) {
  revalidatePath(bidderReofferHref(reofferId));
  revalidatePath("/bids");
  revalidatePath("/purchases");
  revalidatePath("/home");
}

async function answer(
  reofferId: string,
  step: "accept" | "decline",
  body: unknown,
): Promise<Response | null> {
  return authedServerFetch(`/legal-entities/reoffers/${encodeURIComponent(reofferId)}/${step}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/**
 * The bidder accepts the offer: binding, with the terms ticked and the total the page showed. The
 * API refuses (`price_changed`) when the lot would now be invoiced at another total, so nobody is
 * bound to a figure they never saw. Only a signed-in request can accept; no address in an email
 * accepts anything. The lot's id comes back so the person lands on the new purchase, where Pay is
 * ready.
 */
export async function acceptBidderReofferAction(
  reofferId: string,
  termsAccepted: boolean,
  expectedTotalMinor: number,
): Promise<ActionResult<{ lotId: string }>> {
  return instrumentServerAction("acceptBidderReofferAction", async () => {
    const id = reofferIdParamSchema.safeParse({ reofferId });
    const body = acceptReofferBodySchema.safeParse({ termsAccepted, expectedTotalMinor });
    if (!id.success || !body.success) {
      return actionFailure(bidderReofferErrorMessage("terms_not_accepted"), undefined, 422);
    }
    const res = await answer(id.data.reofferId, "accept", body.data);
    if (!res) return actionFailure(REOFFER_UNAVAILABLE, undefined, 503);
    if (!res.ok) return failure(res);
    const result = (await res.json().catch(() => null)) as { data?: { lotId?: unknown } } | null;
    revalidateOffer(id.data.reofferId);
    const lotId = result?.data?.lotId;
    return actionSuccess(typeof lotId === "string" ? { lotId } : undefined);
  });
}

/** The bidder declines the offer, with a reason if they wish to give one. */
export async function declineBidderReofferAction(
  reofferId: string,
  input: unknown,
): Promise<ActionResult> {
  return instrumentServerAction("declineBidderReofferAction", async () => {
    const id = reofferIdParamSchema.safeParse({ reofferId });
    const body = declineReofferBodySchema.safeParse(input);
    if (!id.success || !body.success) {
      return actionFailure("Keep the reason to 500 characters.", undefined, 422);
    }
    const res = await answer(id.data.reofferId, "decline", body.data);
    if (!res) return actionFailure(REOFFER_UNAVAILABLE, undefined, 503);
    if (!res.ok) return failure(res);
    revalidateOffer(id.data.reofferId);
    return actionSuccess();
  });
}
