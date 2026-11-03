"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  ContactDispatchError,
  type ContactDispatcher,
  type ContactPayload,
  type EnquiryPayload,
} from "@/lib/contact/contact-dispatcher";
import {
  contactFormValuesSchema,
  contactSchema,
  isContactHoneypotFilled,
  parseContactFormData,
  resolveContactName,
} from "@/lib/contact/contact-input";
import { sourcePage, visitorAddress } from "@/lib/contact/contact-request.server";
import { httpContactDispatcher } from "@/lib/contact/http-contact-dispatcher.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { createInMemorySlidingWindowRateLimiter } from "@/lib/rate-limit/in-memory-rate-limiter";
import type { z } from "zod";

const rateLimiter = createInMemorySlidingWindowRateLimiter({
  windowMs: 60_000,
  maxPerWindow: 4,
});

const dispatcher: ContactDispatcher = httpContactDispatcher;

const TOO_MANY = "Too many submissions. Please wait a minute and try again.";
const SEND_FAILED = "We couldn't send your message. Please try again.";

/** The contact form's message as a general enquiry, the first of the structured payloads. */
function generalEnquiry(payload: ContactPayload): EnquiryPayload {
  return { intent: "general", ...payload };
}

/** Sends the enquiry on; the failure message is the form's send-failed state, never a success. */
async function send(
  payload: ContactPayload,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  try {
    await dispatcher.dispatch(generalEnquiry({ ...payload, sourcePage: await sourcePage() }));
    return { ok: true };
  } catch (error) {
    if (!(error instanceof ContactDispatchError)) throw error;
    return {
      ok: false,
      error: error.status === 429 ? TOO_MANY : SEND_FAILED,
      ...(error.status !== undefined ? { status: error.status } : {}),
    };
  }
}

export type ContactActionState = { ok: boolean; error?: string };

export async function submitContactForm(
  _prev: ContactActionState | undefined,
  formData: FormData,
): Promise<ContactActionState> {
  return instrumentServerAction(
    "submitContactForm",
    async () => {
      if (isContactHoneypotFilled(formData)) {
        return { ok: true };
      }

      const parsed = parseContactFormData(formData);
      if (!parsed.ok) {
        return { ok: false, error: "Please check the form and try again." };
      }

      const key = await visitorAddress();
      if (!rateLimiter.consume(key)) {
        return { ok: false, error: TOO_MANY };
      }

      const sent = await send(parsed.data);
      return sent.ok ? { ok: true } : { ok: false, error: sent.error };
    },
    { formData },
  );
}

export async function submitContactFormResult(
  values: z.infer<typeof contactFormValuesSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("submitContactFormResult", async () => {
    const pre = contactFormValuesSchema.safeParse(values);
    if (!pre.success) {
      return actionFailure("Please check the form and try again.");
    }
    const { website, firstName, lastName, ...rest } = pre.data;
    if (String(website ?? "").trim()) {
      return actionSuccess();
    }
    const merged = {
      ...rest,
      name: resolveContactName({ name: rest.name, firstName, lastName }),
    };
    const parsed = contactSchema.safeParse(merged);
    if (!parsed.success) {
      return actionFailure("Please check the form and try again.");
    }
    const key = await visitorAddress();
    if (!rateLimiter.consume(key)) {
      return actionFailure(TOO_MANY);
    }
    const sent = await send(parsed.data);
    return sent.ok ? actionSuccess() : actionFailure(sent.error, undefined, sent.status);
  });
}
