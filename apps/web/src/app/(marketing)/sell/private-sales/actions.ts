"use server";

import { ContactDispatchError, type ContactDispatcher } from "@/lib/contact/contact-dispatcher";
import { sourcePage, visitorAddress } from "@/lib/contact/contact-request.server";
import { httpContactDispatcher } from "@/lib/contact/http-contact-dispatcher.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { EnquirerOrganisation } from "@/lib/private-sales/enquiring-as";
import { enquiryFormSchema } from "@/lib/private-sales/enquiry-form-schema";
import { toEnquiryPayload } from "@/lib/private-sales/enquiry-payload";
import type { EnquiryFormValues } from "@/lib/private-sales/enquiry-values";
import { createInMemorySlidingWindowRateLimiter } from "@/lib/rate-limit/in-memory-rate-limiter";

const sendLimiter = createInMemorySlidingWindowRateLimiter({ windowMs: 60_000, maxPerWindow: 4 });
const draftLimiter = createInMemorySlidingWindowRateLimiter({ windowMs: 60_000, maxPerWindow: 4 });

const dispatcher: ContactDispatcher = httpContactDispatcher;

const TOO_MANY = "Too many submissions. Please wait a minute and try again.";
const SEND_FAILED = "We couldn't send your enquiry. Please try again.";

/** What the API said when it refused an enquiry it understood, in words for the sender. */
const REFUSALS: Record<string, string> = {
  organisation_not_permitted:
    "You can't send this enquiry for that organisation. Choose Myself, or ask an owner or admin.",
  staff_cannot_enquire: "Staff accounts can't send private sale enquiries.",
};

function failureFor(error: unknown): ActionResult<never> {
  if (!(error instanceof ContactDispatchError)) throw error;
  if (error.status === 429) return actionFailure(TOO_MANY, undefined, 429);
  const refusal = error.code ? REFUSALS[error.code] : undefined;
  return actionFailure(refusal ?? SEND_FAILED, undefined, error.status, error.code);
}

/** Where a visitor's photos are held until they send: a token good for one enquiry. */
export async function startEnquiryDraft(): Promise<ActionResult<{ draftToken: string }>> {
  return instrumentServerAction("startEnquiryDraft", async () => {
    if (!draftLimiter.consume(await visitorAddress()))
      return actionFailure(TOO_MANY, undefined, 429);
    try {
      const { draftToken } = await dispatcher.startDraft();
      return draftToken ? actionSuccess({ draftToken }) : actionFailure(SEND_FAILED);
    } catch (error) {
      return failureFor(error);
    }
  });
}

/**
 * The organisations the signed-in person may send an enquiry for. Choosing one is a convenience,
 * so a failure to load them leaves the person enquiring as themselves.
 */
export async function loadEnquirerOrganisations(): Promise<EnquirerOrganisation[]> {
  return instrumentServerAction("loadEnquirerOrganisations", async () => {
    try {
      return await dispatcher.organisations();
    } catch {
      return [];
    }
  });
}

export type PrivateSaleSendContext = {
  /** The checked files, in the order shown. */
  uploadIds: string[];
  draftToken?: string | undefined;
  /** The organisation chosen in "Enquiring as". */
  legalEntityId?: string | undefined;
};

export type PrivateSaleReceipt = { reference: string; replyBy: string };

/** Checks the answers again, then sends the enquiry; the failure message is the form's own notice. */
export async function submitPrivateSaleEnquiry(
  values: EnquiryFormValues,
  context: PrivateSaleSendContext,
): Promise<ActionResult<PrivateSaleReceipt>> {
  return instrumentServerAction("submitPrivateSaleEnquiry", async () => {
    const checked = enquiryFormSchema.safeParse(values);
    if (!checked.success) return actionFailure("Please check the form and try again.");
    if (checked.data.website.trim()) return actionSuccess({ reference: "", replyBy: "" });
    if (!sendLimiter.consume(await visitorAddress()))
      return actionFailure(TOO_MANY, undefined, 429);
    try {
      const receipt = await dispatcher.dispatch({
        ...toEnquiryPayload(checked.data as EnquiryFormValues, context),
        sourcePage: await sourcePage(),
      });
      return actionSuccess(receipt);
    } catch (error) {
      return failureFor(error);
    }
  });
}
