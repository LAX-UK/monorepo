import type { MarketingAttributionSnapshot } from "@auction/types";
import {
  decodeMarketingAttributionHeaderRaw,
  encodeMarketingAttributionHeaderJson,
  parseMarketingAttributionSnapshot,
} from "@auction/validators";

const MAX_HEADER_BYTES = 4096;

export function parseAttributionHeader(
  raw: string | undefined,
): MarketingAttributionSnapshot | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (Buffer.byteLength(trimmed, "utf8") > MAX_HEADER_BYTES) return null;
  const json = decodeMarketingAttributionHeaderRaw(trimmed);
  if (!json) return null;
  try {
    return parseMarketingAttributionSnapshot(JSON.parse(json));
  } catch {
    return null;
  }
}

export function serializeAttributionHeader(snapshot: MarketingAttributionSnapshot): string | null {
  const json = JSON.stringify(snapshot);
  return encodeMarketingAttributionHeaderJson(json);
}
