import type { AdminDeliveryQuote, AdminDeliveryQuoteView } from "@auction/shop-contracts";
import {
  type DeliveryQuoteInputField,
  QUOTE_CARRIER_MAX_LENGTH,
  QUOTE_DECLINE_NOTE_MAX_LENGTH,
  QUOTE_LEAD_TIME_NOTE_MAX_LENGTH,
  QUOTE_PRICE_MAX_PENCE,
  QUOTE_SERVICE_MAX_LENGTH,
  declineNoteIssue,
  deliveryQuoteInputIssues,
} from "@auction/shop-domain";
import { formatPenceAsPounds } from "@auction/staff-ui";

/*
 * LAX Admin › Orders › Delivery quotes, in words. The rules are the domain's, run as staff type and
 * again by shop-api on save; this file only says them in plain sentences.
 */

export const DELIVERY_QUOTE_VIEWS: readonly { id: AdminDeliveryQuoteView; label: string }[] = [
  { id: "waiting", label: "Waiting for a price" },
  { id: "quoted", label: "Quoted" },
  { id: "closed", label: "Closed" },
];

export function parseDeliveryQuoteView(
  value: string | string[] | undefined,
): AdminDeliveryQuoteView {
  return DELIVERY_QUOTE_VIEWS.find((view) => view.id === value)?.id ?? "waiting";
}

export const QUOTE_FIELD_LABELS: Record<DeliveryQuoteInputField, string> = {
  pricePence: "Delivery price",
  carrier: "Carrier",
  service: "Service",
  leadTimeNote: "Delivery time note",
};

const QUOTE_MESSAGES: Record<string, string> = {
  not_whole_pence: "Enter a price in pounds and pence",
  below_one_penny: "Enter a price of at least 1p",
  too_high: `Enter a price of £${(QUOTE_PRICE_MAX_PENCE / 100).toLocaleString("en-GB")} or less`,
};

function quoteMessage(field: DeliveryQuoteInputField, reason: string): string {
  if (field === "carrier" && reason === "required") return "Enter the carrier";
  if (reason === "too_long") {
    const max = {
      carrier: QUOTE_CARRIER_MAX_LENGTH,
      service: QUOTE_SERVICE_MAX_LENGTH,
      leadTimeNote: QUOTE_LEAD_TIME_NOTE_MAX_LENGTH,
      pricePence: 0,
    }[field];
    return `Use ${max} characters or fewer`;
  }
  return QUOTE_MESSAGES[reason] ?? "Check this field";
}

export type QuoteFormValues = {
  /** Whole pence, or null while the field is empty or not an amount. */
  pricePence: number | null;
  carrier: string;
  service: string;
  leadTimeNote: string;
};

export type QuoteBody = {
  pricePence: number;
  carrier: string;
  service?: string;
  leadTimeNote?: string;
};

export type QuoteFormCheck =
  | { ok: true; body: QuoteBody }
  | { ok: false; errors: Partial<Record<DeliveryQuoteInputField, string>> };

/** The form's starting values: what was quoted before, when staff are revising a quote. */
export function quoteFormValues(request: AdminDeliveryQuote): QuoteFormValues {
  return {
    pricePence: request.quote?.pricePence ?? null,
    carrier: request.quote?.carrier ?? "",
    service: request.quote?.service ?? "",
    leadTimeNote: request.quote?.leadTimeNote ?? "",
  };
}

export function checkQuoteForm(values: QuoteFormValues): QuoteFormCheck {
  const errors: Partial<Record<DeliveryQuoteInputField, string>> = {};
  if (values.pricePence === null) errors.pricePence = "Enter the delivery price in pounds";
  const issues = deliveryQuoteInputIssues({
    pricePence: values.pricePence ?? 0,
    carrier: values.carrier,
    service: values.service,
    leadTimeNote: values.leadTimeNote,
  });
  for (const issue of issues) {
    if (!(issue.field in errors)) errors[issue.field] = quoteMessage(issue.field, issue.reason);
  }
  if (Object.keys(errors).length > 0 || values.pricePence === null) return { ok: false, errors };
  const service = values.service.trim();
  const leadTimeNote = values.leadTimeNote.trim();
  return {
    ok: true,
    body: {
      pricePence: values.pricePence,
      carrier: values.carrier.trim(),
      ...(service ? { service } : {}),
      ...(leadTimeNote ? { leadTimeNote } : {}),
    },
  };
}

/** The sentence for each field the server named when it refused a quote or a decline. */
export function quoteIssueMessages(
  issues: readonly { field: string; reason: string }[],
): Partial<Record<DeliveryQuoteInputField | "note", string>> {
  const messages: Partial<Record<DeliveryQuoteInputField | "note", string>> = {};
  for (const issue of issues) {
    const field = issue.field as DeliveryQuoteInputField | "note";
    if (field in messages) continue;
    messages[field] =
      field === "note" ? declineMessage(issue.reason) : quoteMessage(field, issue.reason);
  }
  return messages;
}

function declineMessage(reason: string): string {
  return reason === "too_long"
    ? `Use ${QUOTE_DECLINE_NOTE_MAX_LENGTH} characters or fewer`
    : "Tell the buyer why we can't deliver there";
}

/** The sentence under the decline note, or null when it is fine. */
export function checkDeclineNote(note: string): string | null {
  const issue = declineNoteIssue(note);
  return issue ? declineMessage(issue) : null;
}

/** "£85.00". */
export const quotePrice = (pence: number) => `£${formatPenceAsPounds(pence)}`;

const END_REASON_LABELS = {
  cancelled_by_buyer: "Cancelled by the buyer",
  cannot_deliver: "We can't deliver there",
  expired: "Not paid in time",
} as const;

/** How a request reads in the list: its state, in a word or two. */
export function quoteStatusLabel(request: AdminDeliveryQuote): string {
  switch (request.status) {
    case "requested":
      return "Waiting for a price";
    case "quoted":
      return "Quote sent";
    case "accepted":
      return "Accepted, paying";
    case "withdrawn":
      return request.endReason ? END_REASON_LABELS[request.endReason] : "Closed";
  }
}

export {
  QUOTE_CARRIER_MAX_LENGTH,
  QUOTE_DECLINE_NOTE_MAX_LENGTH,
  QUOTE_LEAD_TIME_NOTE_MAX_LENGTH,
  QUOTE_SERVICE_MAX_LENGTH,
};
