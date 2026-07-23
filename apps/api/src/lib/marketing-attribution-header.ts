import type { MarketingAttributionSnapshot } from "@auction/types";
import { parseMarketingAttributionSnapshot } from "@auction/validators";

const MAX_HEADER_BYTES = 4096;

export function parseAttributionHeader(
  raw: string | undefined,
): MarketingAttributionSnapshot | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (Buffer.byteLength(trimmed, "utf8") > MAX_HEADER_BYTES) return null;
  try {
    return parseMarketingAttributionSnapshot(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function serializeAttributionHeader(snapshot: MarketingAttributionSnapshot): string | null {
  const json = JSON.stringify(snapshot);
  if (Buffer.byteLength(json, "utf8") > MAX_HEADER_BYTES) return null;
  return json;
}
