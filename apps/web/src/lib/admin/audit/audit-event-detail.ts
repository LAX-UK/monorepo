import { SECRET_PLACEHOLDER } from "@auction/types";

/** One field of an event's payload, ready to show. */
export type AuditDetailValue = {
  /** Text to show; `null` when the value is hidden from this viewer. */
  text: string | null;
  /** The value was minimised or removed, so show it as restricted rather than empty. */
  hidden: boolean;
};

export type AuditChange = { label: string; before: AuditDetailValue; after: AuditDetailValue };
export type AuditFact = { label: string; value: AuditDetailValue; copyValue?: string };

export type AuditEventDetail = {
  /** Fields that changed, before and after. Empty for events that record no change. */
  changes: AuditChange[];
  /** Everything else the event carries. */
  facts: AuditFact[];
};

const BEFORE_KEYS = ["before", "previous", "old", "from"] as const;
const AFTER_KEYS = ["after", "current", "new", "to"] as const;
const BEFORE_PREFIX = /^(previous|prev|old|from)(?=[A-Z_])_?(.+)$/;
const AFTER_PREFIX = /^(new|next|to)(?=[A-Z_])_?(.+)$/;
const MONEY_KEY = /^(.*?)(Cents|Pence|Minor)$/;
const MAX_DEPTH = 2;

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** "paymentId" -> "Payment ID", "reason_code" -> "Reason code". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word === "id" ? "ID" : word === "ids" ? "IDs" : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SNAKE_CODE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function formatMoney(minor: number, currency: unknown): string {
  const code = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency : "GBP";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return GBP.format(minor / 100);
  }
}

function formatScalar(value: unknown, formatDate: (iso: string) => string): AuditDetailValue {
  if (value === null || value === undefined) return { text: null, hidden: false };
  if (value === SECRET_PLACEHOLDER) return { text: null, hidden: true };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", hidden: false };
  if (typeof value === "number") return { text: String(value), hidden: false };
  if (typeof value === "string") {
    if (value === "") return { text: null, hidden: false };
    if (ISO_DATE.test(value)) return { text: formatDate(value), hidden: false };
    // A status code such as `withdrawal_requested` reads as words.
    return { text: SNAKE_CODE.test(value) ? value.replaceAll("_", " ") : value, hidden: false };
  }
  return { text: JSON.stringify(value), hidden: false };
}

function formatField(
  key: string,
  value: unknown,
  siblings: Dict,
  formatDate: (iso: string) => string,
): AuditDetailValue {
  if (typeof value === "number" && MONEY_KEY.test(key)) {
    return { text: formatMoney(value, siblings.currency), hidden: false };
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatScalar(item, formatDate))
      .map((item) => item.text ?? "Hidden");
    return parts.length === 0
      ? { text: null, hidden: false }
      : { text: parts.join(", "), hidden: parts.every((part) => part === "Hidden") };
  }
  return formatScalar(value, formatDate);
}

function labelFor(key: string): string {
  const money = MONEY_KEY.exec(key);
  return humanizeKey(money?.[1] ? money[1] : key);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `before` and `after` objects (any of the paired names) compared field by field. */
function changesFromObjects(payload: Dict, formatDate: (iso: string) => string) {
  for (const beforeKey of BEFORE_KEYS) {
    for (const afterKey of AFTER_KEYS) {
      const before = payload[beforeKey];
      const after = payload[afterKey];
      if (!isDict(before) && !isDict(after)) continue;
      const left = isDict(before) ? before : {};
      const right = isDict(after) ? after : {};
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
      const changes: AuditChange[] = keys
        .filter((key) => !sameValue(left[key], right[key]))
        .map((key) => ({
          label: labelFor(key),
          before: formatField(key, left[key], left, formatDate),
          after: formatField(key, right[key], right, formatDate),
        }));
      return { changes, used: new Set([beforeKey, afterKey]) };
    }
  }
  return null;
}

/** `previousStatus` / `newStatus` style pairs among the top-level fields. */
function changesFromPairs(payload: Dict, formatDate: (iso: string) => string) {
  const changes: AuditChange[] = [];
  const used = new Set<string>();
  for (const key of Object.keys(payload)) {
    const match = BEFORE_PREFIX.exec(key);
    if (!match?.[2]) continue;
    const rest = match[2];
    const field = rest.charAt(0).toLowerCase() + rest.slice(1);
    const afterKey = Object.keys(payload).find((candidate) => {
      const after = AFTER_PREFIX.exec(candidate);
      return after?.[2] !== undefined && after[2].toLowerCase() === rest.toLowerCase();
    });
    if (!afterKey) continue;
    used.add(key);
    used.add(afterKey);
    changes.push({
      label: labelFor(field),
      before: formatField(key, payload[key], payload, formatDate),
      after: formatField(afterKey, payload[afterKey], payload, formatDate),
    });
  }
  return { changes, used };
}

function collectFacts(
  source: Dict,
  skip: ReadonlySet<string>,
  formatDate: (iso: string) => string,
  prefix = "",
  depth = 0,
): AuditFact[] {
  const facts: AuditFact[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (skip.has(key) && depth === 0) continue;
    const label = prefix ? `${prefix} · ${labelFor(key)}` : labelFor(key);
    if (isDict(value)) {
      if (depth + 1 >= MAX_DEPTH) {
        facts.push({ label, value: { text: JSON.stringify(value), hidden: false } });
      } else {
        facts.push(...collectFacts(value, new Set(), formatDate, label, depth + 1));
      }
      continue;
    }
    const formatted = formatField(key, value, source, formatDate);
    facts.push({
      label,
      value: formatted,
      ...(typeof value === "string" && /id$/i.test(key) && value ? { copyValue: value } : {}),
    });
  }
  return facts;
}

/**
 * An event's payload as a readable diff: fields that changed with their before and after values,
 * then the remaining facts. Hidden values stay marked as hidden so a restricted viewer can tell a
 * value exists but is not theirs to see.
 */
export function buildAuditEventDetail(
  payload: unknown,
  formatDate: (iso: string) => string,
): AuditEventDetail {
  if (!isDict(payload)) {
    return {
      changes: [],
      facts:
        payload === null || payload === undefined
          ? []
          : [{ label: "Value", value: formatScalar(payload, formatDate) }],
    };
  }
  const fromObjects = changesFromObjects(payload, formatDate);
  const fromPairs = changesFromPairs(payload, formatDate);
  const changes = [...(fromObjects?.changes ?? []), ...fromPairs.changes];
  const used = new Set([...(fromObjects?.used ?? []), ...fromPairs.used]);
  return { changes, facts: collectFacts(payload, used, formatDate) };
}

/** A line for the list: the first change, else the reason, else an amount. */
export function summariseAuditEvent(detail: AuditEventDetail): string {
  const [first, ...rest] = detail.changes;
  if (first) {
    const before = first.before.text ?? (first.before.hidden ? "hidden" : "none");
    const after = first.after.text ?? (first.after.hidden ? "hidden" : "none");
    const more = rest.length > 0 ? ` and ${rest.length} more` : "";
    return `${first.label}: ${before} → ${after}${more}`;
  }
  const preferred = ["Reason", "Note", "Message", "Status", "Amount", "Total", "Email"];
  for (const label of preferred) {
    const fact = detail.facts.find((item) => item.label === label && item.value.text);
    if (fact?.value.text) return `${label}: ${fact.value.text}`;
  }
  return "";
}
