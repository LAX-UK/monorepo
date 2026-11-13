/**
 * Marketing attribution helpers. This module has no schema library: it is in the first scripts of
 * every Bid page (the attribution cookie), so the snapshot check is written out by hand. The Zod
 * schemas for API bodies live in `marketing-attribution-schema.ts`; the parser here accepts and
 * returns exactly what those schemas do (see the equivalence tests).
 */
import type { MarketingAttributionSnapshot, MarketingAttributionTouch } from "@auction/types";
import {
  MARKETING_ATTRIBUTION_VERSION,
  decodeUtf8Base64Url,
  encodeUtf8Base64Url,
} from "@auction/types";

const URL_PARAM_TO_TOUCH: ReadonlyArray<{
  param: string;
  key: keyof Omit<MarketingAttributionTouch, "capturedAt" | "landingPath">;
}> = [
  { param: "utm_source", key: "utmSource" },
  { param: "utm_medium", key: "utmMedium" },
  { param: "utm_campaign", key: "utmCampaign" },
  { param: "utm_id", key: "utmId" },
  { param: "utm_term", key: "utmTerm" },
  { param: "utm_content", key: "utmContent" },
  { param: "utm_source_platform", key: "utmSourcePlatform" },
  { param: "utm_creative_format", key: "utmCreativeFormat" },
  { param: "utm_marketing_tactic", key: "utmMarketingTactic" },
  { param: "gclid", key: "gclid" },
  { param: "gbraid", key: "gbraid" },
  { param: "wbraid", key: "wbraid" },
  { param: "dclid", key: "dclid" },
  { param: "fbclid", key: "fbclid" },
  { param: "msclkid", key: "msclkid" },
];

/** Campaign fields persisted in the attribution snapshot. */
export const CAMPAIGN_QUERY_PARAM_NAMES = URL_PARAM_TO_TOUCH.map(({ param }) => param);

const REDIRECT_ONLY_QUERY_PARAM_NAMES = ["gclsrc", "_gl"] as const;

function firstSearchParamValue(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  param: string,
): string | undefined {
  if (source instanceof URLSearchParams) {
    const raw = source.get(param);
    return raw == null ? undefined : raw;
  }
  const value = source[param];
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : value[0];
}

function sourceParamNames(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): string[] {
  return source instanceof URLSearchParams ? [...source.keys()] : Object.keys(source);
}

function isRedirectPassthroughParam(param: string): boolean {
  return (
    CAMPAIGN_QUERY_PARAM_NAMES.includes(param) ||
    REDIRECT_ONLY_QUERY_PARAM_NAMES.includes(
      param as (typeof REDIRECT_ONLY_QUERY_PARAM_NAMES)[number],
    ) ||
    /^gad_[a-z0-9_]+$/i.test(param)
  );
}

/** Copy persisted campaign fields into a callback URL. */
export function appendCampaignSearchParams(
  target: URLSearchParams,
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): void {
  for (const param of CAMPAIGN_QUERY_PARAM_NAMES) {
    const raw = firstSearchParamValue(source, param);
    if (raw == null) continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 256) continue;
    target.set(param, trimmed);
  }
}

/**
 * Preserve campaign and Google linker parameters through same-site redirects.
 * Redirect-only values are forwarded but never persisted in our attribution snapshot.
 */
export function appendMarketingPassthroughParams(
  target: URLSearchParams,
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): void {
  for (const param of sourceParamNames(source)) {
    if (!isRedirectPassthroughParam(param)) continue;
    const raw = firstSearchParamValue(source, param);
    if (raw == null) continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 2_048) continue;
    target.set(param, trimmed);
  }
}

/** Append redirect-safe marketing parameters while preserving an existing query string. */
export function appendMarketingParamsToPath(
  path: string,
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): string {
  const hashIndex = path.indexOf("#");
  const fragment = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutFragment = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutFragment.indexOf("?");
  const pathname = qIndex >= 0 ? withoutFragment.slice(0, qIndex) : withoutFragment;
  const query = new URLSearchParams(qIndex >= 0 ? withoutFragment.slice(qIndex + 1) : "");
  appendMarketingPassthroughParams(query, source);
  const encoded = query.toString();
  return `${encoded ? `${pathname}?${encoded}` : pathname}${fragment}`;
}

function hasCampaignSignal(touch: MarketingAttributionTouch): boolean {
  return URL_PARAM_TO_TOUCH.some(({ key }) => touch[key] != null && touch[key] !== "");
}

/** Parse allowlisted params from a query string (no leading `?` required). */
export function parseAttributionTouchFromSearch(
  search: string,
  landingPath: string,
  capturedAt: string,
): MarketingAttributionTouch | null {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  if (!qs.trim()) return null;
  const params = new URLSearchParams(qs);
  const touch: MarketingAttributionTouch = { capturedAt, landingPath };
  for (const { param, key } of URL_PARAM_TO_TOUCH) {
    const raw = params.get(param);
    if (raw == null) continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 256) continue;
    touch[key] = trimmed;
  }
  return hasCampaignSignal(touch) ? touch : null;
}

/** Parse from full document URL; uses pathname only for landingPath. */
export function parseAttributionTouchFromHref(
  href: string,
  capturedAt: string,
): MarketingAttributionTouch | null {
  try {
    const url = new URL(href);
    return parseAttributionTouchFromSearch(url.search, url.pathname, capturedAt);
  } catch {
    return null;
  }
}

function touchCapturedMs(touch: MarketingAttributionTouch): number {
  return Date.parse(touch.capturedAt);
}

const OPTIONAL_TOUCH_KEYS: ReadonlyArray<
  keyof Omit<MarketingAttributionTouch, "capturedAt" | "landingPath">
> = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmId",
  "utmTerm",
  "utmContent",
  "utmSourcePlatform",
  "utmCreativeFormat",
  "utmMarketingTactic",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
];

/**
 * An ISO date-time with `Z` or a numeric offset, any number of fraction digits, seconds optional;
 * the calendar check includes leap years. The same pattern as Zod 3's
 * `z.string().datetime({ offset: true })`.
 */
const DATETIME_WITH_OFFSET =
  /^((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|([+-]\d{2}:?\d{2}))$/;

/** What Zod 3 parses as an object: not null, an array, a promise-like, a Map, a Set or a Date. */
function isObjectInput(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as { then?: unknown; catch?: unknown };
  if (typeof candidate.then === "function" && typeof candidate.catch === "function") return false;
  return !(value instanceof Map || value instanceof Set || value instanceof Date);
}

/** A string trimmed and between `max` and 1 characters long, or `null`. */
function trimmedField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
}

/** One touch, fields trimmed and unknown keys dropped, or `null` when any field is invalid. */
function parseTouch(value: unknown): MarketingAttributionTouch | null {
  if (!isObjectInput(value)) return null;
  const { capturedAt } = value;
  if (typeof capturedAt !== "string" || !DATETIME_WITH_OFFSET.test(capturedAt)) return null;
  const landingPath = trimmedField(value.landingPath, 2048);
  if (landingPath === null) return null;
  const out: MarketingAttributionTouch = { capturedAt, landingPath };
  for (const key of OPTIONAL_TOUCH_KEYS) {
    const raw = value[key];
    if (raw === undefined) continue;
    const field = trimmedField(raw, 256);
    if (field === null) return null;
    out[key] = field;
  }
  return out;
}

/**
 * The stored snapshot (`version` 1 and at least one valid touch), compatible with
 * exactOptionalPropertyTypes, or `null` when it is not one.
 */
export function parseMarketingAttributionSnapshot(
  value: unknown,
): MarketingAttributionSnapshot | null {
  if (!isObjectInput(value) || value.version !== MARKETING_ATTRIBUTION_VERSION) return null;
  const out: MarketingAttributionSnapshot = { version: MARKETING_ATTRIBUTION_VERSION };
  if (value.firstTouch !== undefined) {
    const firstTouch = parseTouch(value.firstTouch);
    if (firstTouch === null) return null;
    out.firstTouch = firstTouch;
  }
  if (value.lastTouch !== undefined) {
    const lastTouch = parseTouch(value.lastTouch);
    if (lastTouch === null) return null;
    out.lastTouch = lastTouch;
  }
  return out.firstTouch !== undefined || out.lastTouch !== undefined ? out : null;
}

/** Merge incoming landing into snapshot (first write-once, last when newer campaign). */
export function mergeAttributionSnapshot(
  existing: MarketingAttributionSnapshot | null | undefined,
  incomingTouch: MarketingAttributionTouch,
): MarketingAttributionSnapshot {
  const base: MarketingAttributionSnapshot = existing ?? {
    version: MARKETING_ATTRIBUTION_VERSION,
  };
  const incomingMs = touchCapturedMs(incomingTouch);
  const next: MarketingAttributionSnapshot = { version: MARKETING_ATTRIBUTION_VERSION };

  if (base.firstTouch) {
    next.firstTouch = base.firstTouch;
  } else {
    next.firstTouch = incomingTouch;
  }

  const lastMs = base.lastTouch ? touchCapturedMs(base.lastTouch) : 0;
  if (!base.lastTouch || incomingMs >= lastMs) {
    next.lastTouch = incomingTouch;
  } else {
    next.lastTouch = base.lastTouch;
  }

  return next;
}

export function emptyAttributionSnapshot(): MarketingAttributionSnapshot {
  return { version: MARKETING_ATTRIBUTION_VERSION };
}

/** Server-side merge for authenticated PUT (preserve first touch, monotonic last touch). */
export function mergeServerAttributionPut(
  existing: MarketingAttributionSnapshot | null | undefined,
  incoming: MarketingAttributionSnapshot,
): MarketingAttributionSnapshot {
  let next: MarketingAttributionSnapshot = existing ?? emptyAttributionSnapshot();
  if (incoming.firstTouch && !next.firstTouch) {
    next = { ...next, firstTouch: incoming.firstTouch };
  }
  if (incoming.lastTouch) {
    const inc = incoming.lastTouch;
    const lastMs = next.lastTouch ? Date.parse(next.lastTouch.capturedAt) : 0;
    const incMs = Date.parse(inc.capturedAt);
    if (!next.lastTouch || incMs >= lastMs) {
      next = { ...next, lastTouch: inc };
    }
  }
  return next;
}

const MARKETING_ATTRIBUTION_HEADER_PREFIX = "1.";

/** ASCII-safe wire format for `x-lax-attribution` (Fetch Headers reject non-Latin-1). */
export function encodeMarketingAttributionHeaderJson(json: string): string | null {
  const wire = `${MARKETING_ATTRIBUTION_HEADER_PREFIX}${encodeUtf8Base64Url(json)}`;
  if (new TextEncoder().encode(wire).byteLength > 4096) return null;
  return wire;
}

export function decodeMarketingAttributionHeaderRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith(MARKETING_ATTRIBUTION_HEADER_PREFIX)) {
    return decodeUtf8Base64Url(trimmed.slice(MARKETING_ATTRIBUTION_HEADER_PREFIX.length));
  }
  return trimmed;
}

export type AttributionPublisherVendor = "meta" | "sgtm";

const VENDOR_CLICK_ID_KEYS: Record<
  AttributionPublisherVendor,
  ReadonlySet<keyof MarketingAttributionTouch>
> = {
  meta: new Set(["fbclid"]),
  sgtm: new Set(["gclid", "gbraid", "wbraid", "dclid", "msclkid"]),
};

/** Namespaced GA4 / sGTM event params (not reserved utm_* campaign fields). */
export function attributionToPublisherParams(
  prefix: "first" | "last",
  touch: MarketingAttributionTouch | undefined,
  vendor: AttributionPublisherVendor = "sgtm",
): Record<string, string> {
  if (!touch) return {};
  const p = prefix === "first" ? "attribution_first" : "attribution_last";
  const out: Record<string, string> = {
    [`${p}_landing_path`]: touch.landingPath.slice(0, 256),
  };
  const map: Array<[keyof MarketingAttributionTouch, string]> = [
    ["utmSource", "source"],
    ["utmMedium", "medium"],
    ["utmCampaign", "campaign"],
    ["utmId", "campaign_id"],
    ["utmTerm", "term"],
    ["utmContent", "content"],
    ["utmSourcePlatform", "source_platform"],
    ["utmCreativeFormat", "creative_format"],
    ["utmMarketingTactic", "marketing_tactic"],
    ["gclid", "gclid"],
    ["gbraid", "gbraid"],
    ["wbraid", "wbraid"],
    ["dclid", "dclid"],
    ["fbclid", "fbclid"],
    ["msclkid", "msclkid"],
  ];
  const allowedClickIds = VENDOR_CLICK_ID_KEYS[vendor];
  for (const [field, suffix] of map) {
    const v = touch[field];
    if (typeof v !== "string" || v.length === 0) continue;
    if (
      (field === "gclid" ||
        field === "gbraid" ||
        field === "wbraid" ||
        field === "dclid" ||
        field === "fbclid" ||
        field === "msclkid") &&
      !allowedClickIds.has(field)
    ) {
      continue;
    }
    out[`${p}_${suffix}`] = v.slice(0, 256);
  }
  return out;
}
