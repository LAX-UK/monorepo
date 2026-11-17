import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { minorUnitsToMoneyString } from "@auction/domain";
import type { ParsedPence } from "@auction/ui/lib/money";
import { DELIVERIES_COPY } from "./deliveries-copy";

const COPY = DELIVERIES_COPY.quote;

/** The note's limit, as `staffDeliveryQuoteSchema` holds it on the route. */
export const QUOTE_NOTE_MAX_LENGTH = 500;

/**
 * The route takes pounds as `^\d{1,12}(\.\d{1,2})?$`, so the highest price it reads is
 * 999,999,999,999.99; anything above is refused here with the route's own words.
 */
const MAX_PRICE_PENCE = 99_999_999_999_999;

/** Which of the two actions a delivery offers staff (D5), or none. */
export type QuoteAction = "send" | "change";

/**
 * Send quote while the buyer waits for a price, Change quote once one is sent, nothing after
 * (accepted, withdrawn, closed): the same steps the domain's table of moves gives staff.
 */
export function quoteActionFor(row: Pick<DeliveryView, "quote">): QuoteAction | null {
  if (row.quote.status === "requested") return "send";
  if (row.quote.status === "quoted") return "change";
  return null;
}

/** What the dialog's fields hold: the price in whole pence, as `MoneyInput` hands it over. */
export type QuoteFormValues = {
  pence: number | null;
  /** Why the price is null: nothing typed, or text that is not an amount. */
  parse: Extract<ParsedPence, { ok: false }>["reason"] | null;
  note: string;
};

export type QuoteFormField = "price" | "note";
export type QuoteFormErrors = Partial<Record<QuoteFormField, string>>;

/** The fields as the dialog opens: empty to send, the current price and note to change. */
export function quoteFormValues(row: Pick<DeliveryView, "quote">): QuoteFormValues {
  const changing = quoteActionFor(row) === "change";
  return {
    pence: changing ? row.quote.amountMinor : null,
    parse: changing && row.quote.amountMinor !== null ? null : "empty",
    note: changing ? (row.quote.note ?? "") : "",
  };
}

/** The price and the note against the route's rules, in the route's words. */
export function checkQuoteForm(values: QuoteFormValues): QuoteFormErrors {
  const errors: QuoteFormErrors = {};
  if (values.pence === null) {
    errors.price =
      values.parse === "invalid" || values.parse === "too_precise"
        ? COPY.errors.priceInvalid
        : COPY.errors.priceMissing;
  } else if (values.pence <= 0) {
    errors.price = COPY.errors.priceZero;
  } else if (values.pence > MAX_PRICE_PENCE) {
    errors.price = COPY.errors.priceInvalid;
  }
  if (values.note.trim().length > QUOTE_NOTE_MAX_LENGTH) {
    errors.note = COPY.errors.noteTooLong(QUOTE_NOTE_MAX_LENGTH);
  }
  return errors;
}

/** The route's body: pounds as a plain decimal string ("1250.00", no commas), the note or null. */
export function quoteRequestBody(values: { pence: number; note: string }): {
  amount: string;
  note: string | null;
} {
  const note = values.note.trim();
  return { amount: minorUnitsToMoneyString(BigInt(values.pence)), note: note === "" ? null : note };
}

/**
 * What the dialog saw when it opened, sent with the write so the server can tell that the
 * delivery moved on in the meantime (another person quoted it, or the buyer withdrew or accepted).
 */
export type QuoteExpectation = { status: "requested" | "quoted"; quotedAt: string | null };

export function quoteExpectation(row: Pick<DeliveryView, "quote">): QuoteExpectation | null {
  const action = quoteActionFor(row);
  if (!action) return null;
  return { status: row.quote.status as "requested" | "quoted", quotedAt: row.quote.quotedAt };
}

/** How the delivery as read now compares with what the dialog saw. */
export type QuoteDrift = "none" | "already_quoted" | "changed";

export function quoteDrift(
  expected: QuoteExpectation,
  current: Pick<DeliveryView, "quote"> | null,
): QuoteDrift {
  if (!current) return "changed";
  const { status, quotedAt } = current.quote;
  if (status === expected.status && quotedAt === expected.quotedAt) return "none";
  // Still open to staff, but priced (again) by someone else: say so rather than overwrite it.
  if (status === "quoted") return "already_quoted";
  return "changed";
}
