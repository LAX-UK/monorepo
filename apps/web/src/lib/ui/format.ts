/**
 * Centralized formatting for staff admin and shared web surfaces.
 * Prefer these over raw `Intl` / `toLocaleString` in admin code.
 */

import { PLATFORM_DEFAULT_CURRENCY } from "@/lib/money/currency";
import {
  calendarYear,
  formatDate as datetimeFormatDate,
  formatTime,
  runtimeTimeZone,
} from "@auction/datetime";

const DEFAULT_MONEY_LOCALE = "en-GB";
const DEFAULT_DATE_LOCALE = "en-GB";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string, locale = DEFAULT_MONEY_LOCALE): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
    moneyFormatters.set(key, fmt);
  }
  return fmt;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format currency for display (defaults platform GBP). */
export function formatMoney(
  amount: string | number,
  currency = PLATFORM_DEFAULT_CURRENCY,
  locale = DEFAULT_MONEY_LOCALE,
): string {
  if (amount === "undefined" || amount === "null") return "—";
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) {
    if (typeof amount === "string" && amount.trim() !== "" && !/^-?\d/.test(amount.trim())) {
      return amount;
    }
    return "—";
  }
  return moneyFormatter(normalizeCurrencyCode(currency), locale).format(n);
}

function normalizeCurrencyCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : PLATFORM_DEFAULT_CURRENCY;
}

/** "19 May": the day and short month in the runtime zone, without the year. */
function dayAndMonth(d: Date): string {
  return datetimeFormatDate(d, runtimeTimeZone()).replace(/ \d{4}$/, "");
}

function twoDigitYear(d: Date): string {
  return String(calendarYear(d, runtimeTimeZone())).slice(-2);
}

/** Short date, e.g. 19 May 2026 */
export function formatDate(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return datetimeFormatDate(d, runtimeTimeZone());
}

/**
 * `formatDate` for a date inside a sentence: its spaces are non-breaking, so a line never wraps
 * between "4" and "Nov 2026". Use it for display text; keep `formatDate` for values compared or
 * parsed elsewhere.
 */
export function formatDateInline(value: Date | string | number | null | undefined): string {
  return formatDate(value).replace(/ /g, " ");
}

/**
 * A payout period as "1 Jan 2026 → 22 Jun 2026". Settlements that cover everything up to the end
 * date are stored with an epoch start (1 Jan 1970); that reads as "Up to 22 Jun 2026".
 */
export function formatPeriod(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
): string {
  const from = toDate(start);
  const to = toDate(end);
  const openStart = from == null || from.getTime() < 86_400_000;
  if (openStart) return to ? `Up to ${formatDate(to)}` : "—";
  return `${formatDate(from)} → ${formatDate(to)}`;
}

/** Dense table date with 2-digit year, e.g. 19 May 26 */
export function formatDateShort(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${dayAndMonth(d)} ${twoDigitYear(d)}`;
}

/** Date + time for staff tables and detail panels */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const zone = runtimeTimeZone();
  return `${datetimeFormatDate(d, zone)}, ${formatTime(d, zone)}`;
}

/** Compact date + time for table secondary lines (drops year when same as reference). */
export function formatDateTimeShort(
  value: Date | string | number | null | undefined,
  reference: Date = new Date(),
): string {
  const d = toDate(value);
  if (!d) return "—";
  const zone = runtimeTimeZone();
  const sameYear = calendarYear(d, zone) === calendarYear(reference, zone);
  const day = dayAndMonth(d);
  return `${sameYear ? day : `${day} ${twoDigitYear(d)}`}, ${formatTime(d, zone)}`;
}

/** Relative time, e.g. "3 hours ago" */
export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  locale = DEFAULT_DATE_LOCALE,
): string {
  const d = toDate(value);
  if (!d) return "—";
  const diffMs = d.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), "second");
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60_000), "minute");
  const absHr = Math.round(absMin / 60);
  if (absHr < 24) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  const absDay = Math.round(absHr / 24);
  if (absDay < 30) return rtf.format(Math.round(diffMs / 86_400_000), "day");
  return formatDate(d);
}

/**
 * When something happened, measured from `now`: relative within the last day ("3 hours ago",
 * "just now"), otherwise the date in the house style ("29 Oct 2026"). A time ahead of `now`
 * (clock skew) reads as "just now" rather than a date in the future.
 */
export function formatEventTime(
  value: Date | string | number | null | undefined,
  now: Date,
  locale = DEFAULT_DATE_LOCALE,
): string {
  const d = toDate(value);
  if (!d) return "—";
  const elapsedMs = now.getTime() - d.getTime();
  if (elapsedMs >= 24 * 3_600_000) return formatDateInline(d);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.floor(Math.max(elapsedMs, 0) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return rtf.format(-minutes, "minute");
  return rtf.format(-Math.floor(minutes / 60), "hour");
}

/** Percent, e.g. 12.5% */
export function formatPercent(value: number, locale = DEFAULT_DATE_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** Compact count for KPI tiles */
export function formatCount(value: number, locale = DEFAULT_DATE_LOCALE): string {
  return new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
}

/** Plain number for aggregates (no currency symbol) */
export function formatNumber(
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
  locale = DEFAULT_DATE_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/** Compact currency for KPI strips */
export function formatCompactMoney(
  amount: number,
  currency = "GBP",
  locale = DEFAULT_DATE_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Money for a KPI tile: whole pounds below 100k, compact above, so the value fits a tile
 * without truncating ("£83,750", "£1.2m"). Zero reads "£0".
 */
export function formatKpiMoney(
  amount: number | string | null | undefined,
  currency = PLATFORM_DEFAULT_CURRENCY,
  locale = DEFAULT_MONEY_LOCALE,
): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (n == null || !Number.isFinite(n)) return "—";
  const code = normalizeCurrencyCode(currency);
  if (Math.abs(n) < 100_000) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Em dash for empty table cells and null values */
export function dash(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
}

/** Re-export for backward compatibility with marketing components */
export { formatMoney as formatMoneyUsd };
