import { maskEmail, maskName, maskPhone, scrubText } from "./scrub.js";

/** One line of the masked payload as staff see it. */
export type MaskedPayloadEntry = { label: string; value: string; masked: boolean };

export type MaskedPayload = {
  entries: MaskedPayloadEntry[];
  /** Fields that were left out because they are not on the list of safe fields. */
  omitted: number;
};

type FieldMode = "omit" | "email" | "phone" | "name" | "keep";

type FieldRule = { readonly match: RegExp; readonly mode: FieldMode };

/**
 * How a payload field is shown, first match wins. Credentials and message bodies are never shown;
 * personal fields are shown partly; identifiers, amounts and plain enumerations are kept. A field
 * that matches no rule is left out, so a new field never appears raw by accident. Adding a kind
 * of field means adding a row here, not another branch.
 */
const FIELD_RULES: readonly FieldRule[] = [
  {
    match:
      /(^|[._-])(password|passwd|secret|token|authorization|cookie|signature|apikey|api_key|key|credential|html|body|text|vars|message|address|line1|line2|postcode|iban|card|account_?number|sort_?code)([._-]|$)|token$|secret$|key$/i,
    mode: "omit",
  },
  { match: /e-?mail/i, mode: "email" },
  { match: /(phone|mobile|tel)(number)?$/i, mode: "phone" },
  {
    match: /(^|[._-])(name|first_?name|last_?name|full_?name|display_?name|recipient_?name)$/i,
    mode: "name",
  },
  {
    match:
      /(^|[._-])(id|ids|uuid)$|Ids?$|(^|[._-])(at|date|count|total|pence|amount|currency|status|state|kind|type|template|template_?key|template_?name|language|locale|lot_?number|reference|event|event_?name|attempt|attempts|queue|job_?name|sale_?id|lot_?id)$|At$|Count$|Pence$|Amount$|Currency$|Status$|Kind$|Type$|Template(Key|Name)?$|Language$|Locale$|Reference$/,
    mode: "keep",
  },
];

const MAX_DEPTH = 3;
const MAX_ENTRIES = 40;
const VALUE_MAX = 200;

function modeFor(key: string): FieldMode {
  const leaf = key.split(".").pop() ?? key;
  for (const rule of FIELD_RULES) {
    if (rule.match.test(leaf)) return rule.mode;
  }
  return "omit";
}

/** "lotId" becomes "Lot ID", "newHighestBidPence" becomes "New highest bid". */
export function payloadLabel(key: string): string {
  const leaf = key.split(".").pop() ?? key;
  const words = leaf
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "pence");
  const text = words
    .map((word) => (word === "id" ? "ID" : word === "ids" ? "IDs" : word === "at" ? "time" : word))
    .join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const POUNDS = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Amounts are carried in pence; the platform sells in pounds. */
const isPence = (key: string) => /pence$/i.test(key.split(".").pop() ?? key);
const formatPounds = (pence: number) => POUNDS.format(pence / 100);

function shortText(value: string): string {
  const clean = scrubText(value);
  return clean.length > VALUE_MAX ? `${clean.slice(0, VALUE_MAX).trimEnd()}…` : clean;
}

function render(
  key: string,
  mode: FieldMode,
  value: unknown,
): { value: string; masked: boolean } | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return { value: value ? "Yes" : "No", masked: false };
  if (typeof value === "number") {
    return { value: isPence(key) ? formatPounds(value) : String(value), masked: false };
  }
  if (Array.isArray(value)) {
    if (mode === "omit") return null;
    return { value: `${value.length} ${value.length === 1 ? "item" : "items"}`, masked: false };
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  switch (mode) {
    case "email":
      return { value: maskEmail(text), masked: true };
    case "phone":
      return { value: maskPhone(text), masked: true };
    case "name":
      return { value: maskName(text), masked: true };
    case "keep":
      return { value: shortText(text), masked: false };
    case "omit":
      return null;
  }
  return null;
}

/**
 * The safe summary of a job payload: personal fields partly masked, identifiers and amounts kept,
 * everything else counted but not shown. `payload_json` itself never leaves the server.
 */
export function maskJobPayload(payload: unknown): MaskedPayload {
  const entries: MaskedPayloadEntry[] = [];
  let omitted = 0;

  const visit = (key: string, value: unknown, depth: number): void => {
    if (value === null || value === undefined) return;
    const mode = modeFor(key);
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      mode !== "keep" &&
      depth < MAX_DEPTH
    ) {
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
        visit(key ? `${key}.${childKey}` : childKey, child, depth + 1);
      }
      return;
    }
    const shown = mode === "omit" ? null : render(key, mode, value);
    if (!shown) {
      omitted += 1;
      return;
    }
    if (entries.length >= MAX_ENTRIES) return;
    entries.push({ label: payloadLabel(key), ...shown });
  };

  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      visit(key, value, 0);
    }
  } else if (payload !== null && payload !== undefined) {
    omitted += 1;
  }
  return { entries, omitted };
}
