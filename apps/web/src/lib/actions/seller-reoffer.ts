"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { sellerReofferHref } from "@/lib/seller/seller-reoffer-links";
import { reofferIdParamSchema, sellerReofferAnswerBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

/** What the seller is told when their answer does not go through. */
const ERRORS: Readonly<Record<string, string>> = {
  forbidden: "Your role in this account can't answer this request.",
  offer_not_found: "We couldn't find this request.",
  consent_window_ended: "This request has closed. Please contact us and we'll take it from there.",
  consent_already_answered: "This request has already been answered.",
  consent_not_requested: "This lot needs no answer from you.",
  consent_not_allowed: "This answer can't be recorded now.",
  offer_not_open: "This request has been withdrawn or has moved on.",
  lapsed_request_closed: "This request has closed.",
  conflict:
    "That did not go through. Something changed on this request. Reload to see where it is.",
};
const UNAVAILABLE = "Something went wrong on our side. Nothing was changed. Try again in a moment.";

async function failure(res: Response): Promise<ActionResult<never>> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const code = typeof body?.error === "string" ? body.error : undefined;
  return actionFailure(
    code ? (ERRORS[code] ?? UNAVAILABLE) : UNAVAILABLE,
    undefined,
    res.status,
    code,
  );
}

/**
 * The seller's answer to a request to offer their lot to the next bidder: agree, or decline with
 * what they would rather happen. Only the account's owner and admins can; the API decides.
 */
export async function answerSellerReofferAction(
  reofferId: string,
  answer: unknown,
): Promise<ActionResult> {
  return instrumentServerAction("answerSellerReofferAction", async () => {
    const id = reofferIdParamSchema.safeParse({ reofferId });
    const body = sellerReofferAnswerBodySchema.safeParse(answer);
    if (!id.success || !body.success) {
      return actionFailure("Choose what you'd like us to do.", undefined, 422);
    }
    const res = await authedServerFetch(
      `/legal-entities/reoffer-requests/${encodeURIComponent(id.data.reofferId)}/answer`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body.data),
      },
    ).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (!res.ok) return failure(res);
    revalidatePath(sellerReofferHref(id.data.reofferId));
    revalidatePath("/selling/payouts");
    revalidatePath("/home");
    return actionSuccess();
  });
}
