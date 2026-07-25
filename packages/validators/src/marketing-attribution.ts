import type { MarketingAttributionSnapshot, MarketingAttributionTouch } from "@auction/types";
import { MARKETING_ATTRIBUTION_VERSION } from "@auction/types";
import { z } from "zod";

const touchField = z.string().trim().min(1).max(256);

export const marketingAttributionTouchSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  landingPath: z.string().trim().min(1).max(2048),
  utmSource: touchField.optional(),
  utmMedium: touchField.optional(),
  utmCampaign: touchField.optional(),
  utmId: touchField.optional(),
  utmTerm: touchField.optional(),
  utmContent: touchField.optional(),
  utmSourcePlatform: touchField.optional(),
  utmCreativeFormat: touchField.optional(),
  utmMarketingTactic: touchField.optional(),
  gclid: touchField.optional(),
  gbraid: touchField.optional(),
  wbraid: touchField.optional(),
  dclid: touchField.optional(),
  fbclid: touchField.optional(),
  msclkid: touchField.optional(),
});

export const marketingAttributionSnapshotSchema = z
  .object({
    version: z.literal(MARKETING_ATTRIBUTION_VERSION),
    firstTouch: marketingAttributionTouchSchema.optional(),
    lastTouch: marketingAttributionTouchSchema.optional(),
  })
  .refine((snapshot) => snapshot.firstTouch !== undefined || snapshot.lastTouch !== undefined, {
    message: "At least one attribution touch is required",
  });

export const marketingAttributionPutBodySchema = z.object({
  snapshot: marketingAttributionSnapshotSchema,
});

export type MarketingAttributionPutBody = z.infer<typeof marketingAttributionPutBodySchema>;

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

type ParsedTouch = z.infer<typeof marketingAttributionTouchSchema>;

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

function normalizeTouch(touch: ParsedTouch): MarketingAttributionTouch {
  const out: MarketingAttributionTouch = {
    capturedAt: touch.capturedAt,
    landingPath: touch.landingPath,
  };
  for (const key of OPTIONAL_TOUCH_KEYS) {
    const value = touch[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/** Zod-safe parse into a snapshot compatible with exactOptionalPropertyTypes. */
export function parseMarketingAttributionSnapshot(
  value: unknown,
): MarketingAttributionSnapshot | null {
  const parsed = marketingAttributionSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  const out: MarketingAttributionSnapshot = { version: data.version };
  if (data.firstTouch !== undefined) out.firstTouch = normalizeTouch(data.firstTouch);
  if (data.lastTouch !== undefined) out.lastTouch = normalizeTouch(data.lastTouch);
  return out;
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

function utf8ToBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(encoded: string): string | null {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(encoded, "base64url").toString("utf8");
    }
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLen));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** ASCII-safe wire format for `x-lax-attribution` (Fetch Headers reject non-Latin-1). */
export function encodeMarketingAttributionHeaderJson(json: string): string | null {
  const wire = `${MARKETING_ATTRIBUTION_HEADER_PREFIX}${utf8ToBase64Url(json)}`;
  if (new TextEncoder().encode(wire).byteLength > 4096) return null;
  return wire;
}

export function decodeMarketingAttributionHeaderRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith(MARKETING_ATTRIBUTION_HEADER_PREFIX)) {
    return base64UrlToUtf8(trimmed.slice(MARKETING_ATTRIBUTION_HEADER_PREFIX.length));
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
