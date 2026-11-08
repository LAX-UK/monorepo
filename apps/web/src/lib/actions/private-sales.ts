"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { checkoutSchema } from "@/lib/private-sales/party-deals.schema";
import { privateSaleHref } from "@/lib/private-sales/party-deals.vm";
import { privateSaleReferenceSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

/** What a person is told when a step on their private sale does not go through. */
const ERRORS: Readonly<Record<string, string>> = {
  deal_not_found: "We couldn't find this private sale.",
  terms_not_configured: "The terms aren't ready yet. We'll let you know when you can accept them.",
  not_open_for_terms: "The terms can't be accepted at this stage.",
  not_payable: "This isn't ready to be paid yet.",
  compliance_hold: "We can't take payment yet. We'll contact you about the next step.",
  not_payable_online: "This amount is paid by arrangement. We'll contact you about how to pay.",
  already_paid: "This has already been paid.",
  in_progress: "Your bank transfer is on its way. There's nothing more to do.",
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

/** Accepts the current private sale terms for the signed-in person's side of the deal. */
export async function acceptPrivateSaleTermsAction(reference: string): Promise<ActionResult> {
  return instrumentServerAction("acceptPrivateSaleTermsAction", async () => {
    const ref = privateSaleReferenceSchema.safeParse(reference);
    if (!ref.success) return actionFailure(ERRORS.deal_not_found as string, undefined, 400);
    const res = await authedServerFetch(
      `/private-sales/${encodeURIComponent(ref.data)}/accept-terms`,
      {
        method: "POST",
      },
    ).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (!res.ok) return failure(res);
    revalidatePath(privateSaleHref(ref.data));
    revalidatePath("/purchases");
    revalidatePath("/selling/consignments");
    return actionSuccess();
  });
}

/** Opens the checkout that pays the invoice and returns where to send the buyer. */
export async function startPrivateSalePaymentAction(
  reference: string,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  return instrumentServerAction("startPrivateSalePaymentAction", async () => {
    const ref = privateSaleReferenceSchema.safeParse(reference);
    if (!ref.success) return actionFailure(ERRORS.deal_not_found as string, undefined, 400);
    const res = await authedServerFetch(`/private-sales/${encodeURIComponent(ref.data)}/payment`, {
      method: "POST",
    }).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (!res.ok) return failure(res);
    const { checkoutUrl } = readDataEnvelope(
      await readJsonBody(res),
      checkoutSchema,
      "POST /private-sales/:ref/payment",
    );
    return actionSuccess({ checkoutUrl });
  });
}
