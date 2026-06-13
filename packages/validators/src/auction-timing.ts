import type { AuctionTimingValue, OptionalIsoTime } from "@auction/types";

/** Normalize an auction instant to ISO 8601, or null when unknown. */
export function normalizeAuctionTime(value: AuctionTimingValue): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (value === "") return null;
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

/** ISO string when valid; otherwise `undefined` (for optional VM fields and SEO). */
export function toOptionalIsoString(value: unknown): OptionalIsoTime {
  if (value instanceof Date || typeof value === "string" || value == null) {
    return normalizeAuctionTime(value) ?? undefined;
  }
  if (typeof value === "number") {
    return normalizeAuctionTime(new Date(value)) ?? undefined;
  }
  if (typeof value === "object" && value !== null && "toISOString" in value) {
    try {
      return normalizeAuctionTime(value as Date) ?? undefined;
    } catch {
      return undefined;
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

/** ISO string for display/export rows; falls back when timing is missing. */
export function toRequiredIsoString(value: AuctionTimingValue, fallback = ""): string {
  return normalizeAuctionTime(value) ?? fallback;
}

/** Live sale countdown target from normalized end time. */
export function toActiveCountdownEndIso(
  status: string,
  endTime: AuctionTimingValue,
): OptionalIsoTime {
  if (status !== "active") return undefined;
  return normalizeAuctionTime(endTime) ?? undefined;
}

/** Parse normalized ISO to epoch ms; null when unknown. */
export function parseNormalizedIsoMs(iso: string | null | undefined): number | null {
  if (iso == null || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Safe Date for formatting helpers that expect a Date instance. */
export function toDisplayDate(value: AuctionTimingValue): Date {
  const iso = normalizeAuctionTime(value);
  if (iso == null) return new Date(Number.NaN);
  return new Date(iso);
}
