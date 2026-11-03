"use server";

import { type AddressValues, validateAddress } from "@/lib/address/address-fields";
import { getServerDataContainer } from "@/lib/data/container.server";
import { profileAddressRowSchema } from "@/lib/data/http/addresses.schema";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { PaySeveralSkipReason } from "@auction/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type DeliveryAddress,
  deliveryAddressFromBook,
  newDeliveryAddressBody,
} from "./delivery-addresses.vm";
import {
  PAY_SEVERAL_START_COPY,
  PAY_SEVERAL_START_FAILED,
  type PaySeveralBlock,
  type PaySeveralPlanView,
  type PaySeveralStart,
} from "./pay-several";
import { purchaseRequestAccountId } from "./purchase-account";
import { type PurchaseProblemFormValues, purchaseProblemFormSchema } from "./purchase-problem";

/**
 * Posts for the account in use; the API checks the member's role on every step. A person's own
 * account is named only when `includePersonal` is set.
 */
async function post(
  path: string,
  body: unknown,
  options: { includePersonal?: boolean } = {},
): Promise<Response> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const account = purchaseRequestAccountId(scope.account, options);
  return authedServerFetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(account ? { [X_LEGAL_ENTITY_ID_HEADER]: account } : {}),
    },
    body: JSON.stringify(body),
  });
}

const lotIdsSchema = z.array(z.string().uuid()).min(1).max(20);

const skipReason = z.enum([
  "other_account",
  "not_owed",
  "not_payer",
  "not_invoiced",
  "held_for_review",
  "being_paid",
]) satisfies z.ZodType<PaySeveralSkipReason>;
const planSchema = z.object({
  payable: z.array(z.object({ lotId: z.string(), totalDue: z.string() })),
  skipped: z.array(z.object({ lotId: z.string(), reason: skipReason })),
  total: z.string(),
  currency: z.string(),
  /** Whether (and how) one payment can take the total. */
  payTogether: z
    .union([
      z.object({ allowed: z.literal(true) }).passthrough(),
      z.object({
        allowed: z.literal(false),
        reason: z.enum(["payer_on_hold", "below_minimum", "over_limit", "needs_finance_review"]),
      }),
    ])
    .optional(),
});

const REFUSAL_BLOCK: Record<string, PaySeveralBlock> = {
  pay_several_nothing_payable: "nothing_payable",
  pay_several_mixed_currency: "mixed_currency",
  pay_several_payer_on_hold: "payer_on_hold",
  pay_several_below_minimum: "below_minimum",
  pay_several_over_limit: "over_limit",
  pay_several_needs_finance_review: "needs_finance_review",
};

async function errorCode(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : null;
}

/** What one payment of the picked invoices would cover, and anything that stops it. */
export async function planPaySeveralAction(
  lotIds: string[],
): Promise<{ ok: true; plan: PaySeveralPlanView } | { ok: false; message: string }> {
  return instrumentServerAction("planPaySeveralAction", async () => {
    const ids = lotIdsSchema.safeParse(lotIds);
    if (!ids.success) return { ok: false, message: "Pick between 1 and 20 invoices." };
    const res = await post("/legal-entities/purchases/pay-several/plan", { lotIds: ids.data });
    if (!res.ok) {
      const block = REFUSAL_BLOCK[(await errorCode(res)) ?? ""];
      if (block) {
        return {
          ok: true,
          plan: {
            payable: [],
            skipped: ids.data.map((lotId) => ({
              lotId,
              reason: "not_owed" as PaySeveralSkipReason,
            })),
            total: "0.00",
            currency: "GBP",
            block,
          },
        };
      }
      return { ok: false, message: "We couldn't work out the total. Try again in a moment." };
    }
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const parsed = planSchema.safeParse(body?.data);
    if (!parsed.success) {
      return { ok: false, message: "We couldn't work out the total. Try again in a moment." };
    }
    const { payTogether, ...plan } = parsed.data;
    return {
      ok: true,
      plan: { ...plan, block: payTogether && !payTogether.allowed ? payTogether.reason : null },
    };
  });
}

const startedSchema = z.object({ checkoutUrl: z.string().min(1) });

/**
 * Holds the picked invoices in one payment and returns its checkout, where the payer chooses
 * card or bank transfer and confirms. A refusal comes back in the payer's words; nothing is
 * charged until the checkout is completed.
 */
export async function startPaySeveralAction(lotIds: string[]): Promise<PaySeveralStart> {
  return instrumentServerAction("startPaySeveralAction", async () => {
    const ids = lotIdsSchema.safeParse(lotIds);
    if (!ids.success) return { ok: false, message: "Pick between 1 and 20 invoices." };
    const res = await post("/legal-entities/purchases/pay-several", { lotIds: ids.data });
    if (!res.ok) {
      const code = await errorCode(res);
      return {
        ok: false,
        message: (code && PAY_SEVERAL_START_COPY[code]) || PAY_SEVERAL_START_FAILED,
      };
    }
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const started = startedSchema.safeParse(body?.data);
    if (!started.success) return { ok: false, message: PAY_SEVERAL_START_FAILED };
    revalidatePath(CLIENT_ROUTES.purchases);
    return { ok: true, url: started.data.checkoutUrl };
  });
}

export type QuoteStepResult = { ok: true } | { ok: false; message: string };

const QUOTE_MESSAGES: Record<string, string> = {
  quote_changed: "The quote changed while you were looking. We've shown the latest.",
  quote_step_not_allowed: "That step isn't open on this quote any more.",
  insufficient_entity_role: "Your role doesn't arrange delivery for this account.",
};

async function quoteStep(path: string, body: unknown, lotId: string): Promise<QuoteStepResult> {
  const res = await post(path, body);
  revalidatePath(`${CLIENT_ROUTES.purchases}/${lotId}`);
  revalidatePath(CLIENT_ROUTES.purchases);
  if (res.ok) return { ok: true };
  const code = await errorCode(res);
  return {
    ok: false,
    message:
      (code && QUOTE_MESSAGES[code]) ?? "We couldn't do that just now. Try again in a moment.",
  };
}

export type SaveDeliveryAddressResult =
  | { ok: true; address: DeliveryAddress }
  | { ok: false; message: string };

/**
 * Saves a new delivery address to the member's LAX Account address book, so it is offered again
 * on the next purchase, and hands it back for the picker.
 */
export async function saveDeliveryAddressAction(
  label: string,
  address: AddressValues,
): Promise<SaveDeliveryAddressResult> {
  return instrumentServerAction("saveDeliveryAddressAction", async () => {
    if (Object.keys(validateAddress(address)).length > 0) {
      return { ok: false, message: "Check the address and try again." } as const;
    }
    const res = await authedServerFetch("/users/me/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeliveryAddressBody(label, address)),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: "We couldn't save that address just now. Try again in a moment.",
      } as const;
    }
    try {
      const row = readDataEnvelope(await readJsonBody(res), profileAddressRowSchema);
      return { ok: true, address: deliveryAddressFromBook(row) } as const;
    } catch {
      return {
        ok: false,
        message: "We couldn't save that address just now. Try again in a moment.",
      } as const;
    }
  });
}

const lotIdSchema = z.string().uuid();
const problemSentSchema = z.object({ problem: z.object({ reference: z.string() }) });
const destinationSchema = z.string().trim().min(5).max(500);

/** Asks the saleroom team to price insured delivery to `destination`. */
export async function requestDeliveryQuoteAction(
  lotId: string,
  destination: string,
): Promise<QuoteStepResult> {
  return instrumentServerAction("requestDeliveryQuoteAction", async () => {
    const id = lotIdSchema.safeParse(lotId);
    const to = destinationSchema.safeParse(destination);
    if (!id.success) return { ok: false, message: "This purchase couldn't be found." };
    if (!to.success) return { ok: false, message: "Enter the full delivery address." };
    return quoteStep(
      `/legal-entities/purchases/${encodeURIComponent(id.data)}/delivery-quote`,
      { destination: to.data },
      id.data,
    );
  });
}

/** Accepts the courier quote: the delivery is booked and its price joins what is owed. */
export async function acceptDeliveryQuoteAction(lotId: string): Promise<QuoteStepResult> {
  return instrumentServerAction("acceptDeliveryQuoteAction", async () => {
    const id = lotIdSchema.safeParse(lotId);
    if (!id.success) return { ok: false, message: "This purchase couldn't be found." };
    return quoteStep(
      `/legal-entities/purchases/${encodeURIComponent(id.data)}/delivery-quote/accept`,
      {},
      id.data,
    );
  });
}

/** Withdraws a courier quote request or declines a quote, so another choice can be made. */
export async function withdrawDeliveryQuoteAction(lotId: string): Promise<QuoteStepResult> {
  return instrumentServerAction("withdrawDeliveryQuoteAction", async () => {
    const id = lotIdSchema.safeParse(lotId);
    if (!id.success) return { ok: false, message: "This purchase couldn't be found." };
    return quoteStep(
      `/legal-entities/purchases/${encodeURIComponent(id.data)}/delivery-quote/withdraw`,
      {},
      id.data,
    );
  });
}

const PROBLEM_FAILURES: Record<string, string> = {
  problem_purchase_not_paid: "You can report a problem once the purchase is paid.",
  purchase_not_found: "This purchase isn't in the account you're using.",
  insufficient_entity_role: "Your role in this account can't report a problem on its purchases.",
};

const PROBLEM_FAILED = "Something went wrong on our side. Try again in a moment.";

/**
 * Reports a problem with a paid purchase to the client services team. Sending again while a
 * report is open returns that report, so a second send never opens a second case.
 */
export async function reportPurchaseProblemAction(
  lotId: string,
  values: PurchaseProblemFormValues,
): Promise<ActionResult<{ reference: string }>> {
  return instrumentServerAction("reportPurchaseProblemAction", async () => {
    const id = lotIdSchema.safeParse(lotId);
    if (!id.success) return actionFailure(PROBLEM_FAILURES.purchase_not_found as string);
    const parsed = purchaseProblemFormSchema.safeParse(values);
    if (!parsed.success) {
      return actionFailure("Check the form and try again.", zodErrorToFieldErrors(parsed.error));
    }
    const scope = await (await getServerDataContainer()).buying.scope();
    if (!purchaseRequestAccountId(scope.account, { includePersonal: true })) {
      return actionFailure(
        "We couldn't tell which account this purchase is in. Refresh and try again.",
      );
    }
    const res = await post(
      `/legal-entities/purchases/${encodeURIComponent(id.data)}/problem`,
      parsed.data,
      { includePersonal: true },
    );
    if (!res.ok) {
      const code = await errorCode(res);
      return actionFailure((code && PROBLEM_FAILURES[code]) || PROBLEM_FAILED);
    }
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const sent = problemSentSchema.safeParse(body?.data);
    if (!sent.success) return actionFailure(PROBLEM_FAILED);
    revalidatePath(`${CLIENT_ROUTES.purchases}/${id.data}`);
    return actionSuccess({ reference: sent.data.problem.reference });
  });
}
