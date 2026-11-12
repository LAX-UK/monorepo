import type { LogLevel, ZohoLogger } from "./ports.js";

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_ITEMS = 20;
const MAX_STRING = 64;

/**
 * Body and query values are kept only for fields known to carry no personal data (opaque ids,
 * amounts, dates, statuses, our own LAX references). Everything else (names, emails, phones,
 * addresses, notes, free text, anything new Zoho adds) is replaced. An allow list fails safe.
 */
const SAFE_FIELDS: ReadonlySet<string> = new Set([
  "code",
  "page",
  "per_page",
  "has_more_page",
  "page_context",
  "organization_id",
  "contact_id",
  "invoice_id",
  "payment_id",
  "creditnote_id",
  "bill_id",
  "customerpayment_id",
  "line_item_id",
  "account_id",
  "currency_code",
  "status",
  "date",
  "due_date",
  "date_start",
  "date_end",
  "last_modified_time",
  "reference_number",
  "invoice_number",
  "creditnote_number",
  "bill_number",
  "payment_number",
  "sub_total",
  "tax_total",
  "total",
  "balance",
  "amount",
  "rate",
  "quantity",
  "tax_percentage",
  "exchange_rate",
  "sort_column",
  "invoices",
  "contacts",
  "creditnotes",
  "bills",
  "customerpayments",
  "line_items",
]);

/** Never kept, even if a key also looks safe (defence in depth for tokens and credentials). */
const SECRET_KEY =
  /token|secret|password|passwd|authorization|cookie|credential|api[-_]?key|apikey/i;

const ZOHO_TOKEN = /\b1000\.[0-9a-f]{20,}\.[0-9a-f]{20,}\b/gi;
const BEARER = /\b(?:Zoho-oauthtoken|Bearer)\s+[^\s"',;]+/gi;
const SECRET_PAIR = /\b((?:access_|refresh_|id_)?token|client_secret|code|password)=([^&\s"']+)/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_DIGITS = /\b\d{7,}\b/g;

/** Masks tokens, emails and long digit runs (phone numbers, card numbers) inside free text. */
export function scrubText(text: string): string {
  return text
    .replace(ZOHO_TOKEN, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(SECRET_PAIR, (_m, key: string) => `${key}=${REDACTED}`)
    .replace(EMAIL, "[email]")
    .replace(LONG_DIGITS, "[number]");
}

function keepScalar(key: string, value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (typeof value === "string") {
    // Zoho's numeric result code is a number; a string called "code" is an OAuth grant code.
    if (key === "code") return REDACTED;
    return scrubText(value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value);
  }
  return REDACTED;
}

/** A log-safe copy of a request or response body: structure and safe fields only. */
export function redactBody(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return REDACTED;
    const items = value.slice(0, MAX_ITEMS).map((item) => redactBody(item, key, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `[+${value.length - MAX_ITEMS} more]`] : items;
  }
  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return REDACTED;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactField(k, v, depth + 1);
    }
    return out;
  }
  return keepScalar(key, value);
}

function redactField(key: string, value: unknown, depth: number): unknown {
  if (SECRET_KEY.test(key)) return REDACTED;
  // Keys we do not know are replaced whole, containers included: a nested "contact_persons" array
  // is never walked, so a name inside it cannot leak.
  if (!SAFE_FIELDS.has(key)) return REDACTED;
  return redactBody(value, key, depth);
}

/** A log-safe copy of a query: only known-safe parameters keep their value. */
export function redactQuery(
  query: Readonly<Record<string, string | number | boolean>> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    out[key] = !SECRET_KEY.test(key) && SAFE_FIELDS.has(key) ? keepScalar(key, value) : REDACTED;
  }
  return out;
}

/** Every string passed to a logger is scrubbed and secret-looking keys are dropped, whatever the caller did. */
export function redactLogFields(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value))
    return value.slice(0, MAX_ITEMS).map((v) => redactLogFields(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? REDACTED : redactLogFields(v, depth + 1);
  }
  return out;
}

/** Wraps a logger so nothing reaches it unredacted. */
export function redactingLogger(inner: ZohoLogger): ZohoLogger {
  return {
    log(level: LogLevel, event: string, fields) {
      inner.log(level, event, redactLogFields(fields) as Record<string, unknown>);
    },
  };
}
