import type { MarketingAttributionSnapshot, MarketingAttributionTouch } from "@auction/types";
import {
  encodeMarketingAttributionHeaderJson,
  parseAttributionTouchFromHref,
  parseMarketingAttributionSnapshot,
} from "@auction/validators/marketing-attribution";

export const LAX_ATTRIBUTION_COOKIE = "_lax_attr";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;
const COOKIE_VALUE_MAX_CHARS = 3_800;

function cookieDomain(): string | undefined {
  const d = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  return d && d.length > 0 ? d : undefined;
}

export function readAttributionCookie(): MarketingAttributionSnapshot | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LAX_ATTRIBUTION_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    return parseMarketingAttributionSnapshot(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function writeAttributionCookie(snapshot: MarketingAttributionSnapshot): void {
  if (typeof document === "undefined") return;
  const domain = cookieDomain();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; domain=${domain}` : "";
  const value = encodeURIComponent(JSON.stringify(snapshot));
  if (value.length > COOKIE_VALUE_MAX_CHARS) return;
  document.cookie = `${LAX_ATTRIBUTION_COOKIE}=${value}; Max-Age=${COOKIE_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}${domainPart}`;
}

export function clearAttributionCookie(): void {
  if (typeof document === "undefined") return;
  const domain = cookieDomain();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${LAX_ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}${domainPart}`;
}

/** Capture campaign params from the initial document URL without reading storage. */
export function captureInitialDocumentTouch(): MarketingAttributionTouch | null {
  if (typeof window === "undefined") return null;
  return parseAttributionTouchFromHref(window.location.href, new Date().toISOString());
}

export function attributionForDataLayer(
  snapshot: MarketingAttributionSnapshot | null,
): Record<string, string> {
  if (!snapshot?.lastTouch) return {};
  const t = snapshot.lastTouch;
  const out: Record<string, string> = {};
  const map: Array<[keyof MarketingAttributionTouch, string]> = [
    ["utmSource", "attribution_last_source"],
    ["utmMedium", "attribution_last_medium"],
    ["utmCampaign", "attribution_last_campaign"],
    ["utmId", "attribution_last_campaign_id"],
  ];
  for (const [field, key] of map) {
    const v = t[field];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return out;
}

export function serializeAttributionHeader(
  snapshot: MarketingAttributionSnapshot | null,
): string | null {
  if (!snapshot) return null;
  const json = JSON.stringify(snapshot);
  return encodeMarketingAttributionHeaderJson(json);
}
