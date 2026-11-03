import { type MaskedPayload, maskEmail, maskName, maskPhone, scrubText } from "@auction/queues";

/** How one allowed field is shown. Personal fields are partly hidden; the rest are kept. */
type FieldFormat = "text" | "id" | "time" | "email" | "name" | "phone" | "pence" | "pounds";

type AllowedField = { path: string; label: string; format: FieldFormat };

const POUNDS = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const VALUE_MAX = 200;

const field = (path: string, label: string, format: FieldFormat = "text"): AllowedField => ({
  path,
  label,
  format,
});

const PAYOUT_AMOUNTS = [
  field("legalEntityId", "Seller ID", "id"),
  field("grossAmount", "Gross amount", "pounds"),
  field("platformFee", "Platform fee", "pounds"),
  field("stripeFee", "Card fee", "pounds"),
  field("netAmount", "Net amount", "pounds"),
  field("currency", "Currency"),
] as const;

const STRIPE_WEBHOOK_FIELDS = [
  field("id", "Event ID", "id"),
  field("type", "Event type"),
  field("data.object.id", "Object ID", "id"),
  field("data.object.amount", "Amount", "pence"),
  field("data.object.amount_total", "Amount", "pence"),
  field("data.object.currency", "Currency"),
  field("data.object.status", "Status"),
  field("data.object.payment_status", "Payment status"),
  field("data.object.payment_intent", "Payment intent", "id"),
] as const;

/**
 * The only fields of an integration payload staff can see, per event type. A field that is not
 * listed here is counted as "left out" and never shown, so a new field in an event stays hidden
 * until someone decides it is safe. Deliveries are keyed by domain event type, webhooks by
 * `webhook.<sender>`. Showing another field is one more row, not another branch.
 */
export const INTEGRATION_PAYLOAD_FIELDS: Readonly<Record<string, readonly AllowedField[]>> = {
  "payment.captured": [
    field("paymentId", "Payment ID", "id"),
    field("lotId", "Lot ID", "id"),
    field("amountCents", "Amount", "pence"),
    field("capturedAt", "Captured", "time"),
    field("via", "Taken by"),
    field("buyerName", "Buyer", "name"),
    field("buyerEmail", "Buyer email", "email"),
  ],
  "payment.refunded": [
    field("stripeChargeId", "Charge ID", "id"),
    field("amountCents", "Amount", "pence"),
    field("amount", "Amount", "pounds"),
    field("cumulativeRefundedCents", "Refunded so far", "pence"),
    field("currency", "Currency"),
    field("via", "Refunded by"),
  ],
  "lot.ended": [
    field("outcome", "Outcome"),
    field("saleId", "Sale ID", "id"),
    field("hammerPrice", "Hammer price", "pounds"),
    field("endedAt", "Ended", "time"),
    field("trigger", "Ended by"),
  ],
  "payout.paid": [
    ...PAYOUT_AMOUNTS,
    field("processedAt", "Paid", "time"),
    field("stripeTransferId", "Transfer ID", "id"),
  ],
  "payout.settlement_created": [
    ...PAYOUT_AMOUNTS,
    field("paymentLineCount", "Payments in the settlement"),
    field("periodStart", "Period start", "time"),
    field("periodEnd", "Period end", "time"),
  ],
  "user.registered": [
    field("userId", "Person ID", "id"),
    field("email", "Email", "email"),
    field("name", "Name", "name"),
    field("source", "Signed up with"),
  ],
  "webhook.stripe": STRIPE_WEBHOOK_FIELDS,
  "webhook.xero": [
    field("routing.eventCategory", "Category"),
    field("routing.eventType", "Event type"),
    field("routing.resourceId", "Xero record ID", "id"),
    field("routing.tenantId", "Xero organisation ID", "id"),
    field("routing.eventDateUtc", "Event time", "time"),
  ],
};

function valueAt(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Counts every value in the payload once: an object is walked, an array or scalar is one. */
function leafPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "object" && !Array.isArray(value) && depth < 6) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key, depth + 1),
    );
  }
  return [prefix];
}

const short = (text: string): string => {
  const clean = scrubText(text);
  return clean.length > VALUE_MAX ? `${clean.slice(0, VALUE_MAX).trimEnd()}…` : clean;
};

function poundsFromDecimal(text: string): string {
  const amount = Number(text);
  return Number.isFinite(amount) ? POUNDS.format(amount) : short(text);
}

type Rendered = { value: string; masked: boolean };

/** Each format as a function, so a new format is one more row. */
const RENDERERS: Readonly<Record<FieldFormat, (value: string | number) => Rendered | null>> = {
  text: (value) => ({ value: short(String(value)), masked: false }),
  id: (value) => ({ value: short(String(value)), masked: false }),
  time: (value) => ({ value: short(String(value)), masked: false }),
  email: (value) => ({ value: maskEmail(String(value)), masked: true }),
  name: (value) => ({ value: maskName(String(value)), masked: true }),
  phone: (value) => ({ value: maskPhone(String(value)), masked: true }),
  pence: (value) =>
    typeof value === "number" ? { value: POUNDS.format(value / 100), masked: false } : null,
  pounds: (value) => ({ value: poundsFromDecimal(String(value)), masked: false }),
};

/**
 * The safe view of a delivery's or webhook's payload: only allow-listed fields, personal ones
 * partly hidden. Everything else is counted in `omitted`, so the screen can say it was left out.
 */
export function maskIntegrationPayload(allowListKey: string, payload: unknown): MaskedPayload {
  const fields = INTEGRATION_PAYLOAD_FIELDS[allowListKey] ?? [];
  const entries: MaskedPayload["entries"] = [];
  const shown = new Set<string>();
  for (const allowed of fields) {
    const raw = valueAt(payload, allowed.path);
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    if (raw === "") continue;
    const rendered = RENDERERS[allowed.format](raw);
    if (!rendered) continue;
    entries.push({ label: allowed.label, ...rendered });
    shown.add(allowed.path);
  }
  const omitted = leafPaths(payload).filter((path) => !shown.has(path)).length;
  return { entries, omitted };
}
