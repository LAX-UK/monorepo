/**
 * Centralized formatting for staff admin and shared web surfaces.
 * Prefer these over raw `Intl` / `toLocaleString` in admin code.
 */

import { PLATFORM_DEFAULT_CURRENCY } from "@/lib/money/currency";

const DEFAULT_MONEY_LOCALE = "en-GB";
const DEFAULT_DATE_LOCALE = "en-GB";

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function moneyFormatter(currency: string, locale = DEFAULT_MONEY_LOCALE): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
    moneyFormatters.set(key, fmt);
  }
  return fmt;
}

function dateFormatter(
  options: Intl.DateTimeFormatOptions,
  locale = DEFAULT_DATE_LOCALE,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let fmt = dateFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, fmt);
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

/** Short date, e.g. 19 May 2026 */
export function formatDate(
  value: Date | string | number | null | undefined,
  locale = DEFAULT_DATE_LOCALE,
): string {
  const d = toDate(value);
  if (!d) return "—";
  return dateFormatter({ day: "numeric", month: "short", year: "numeric" }, locale).format(d);
}

/** Date + time for staff tables and detail panels */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  locale = DEFAULT_DATE_LOCALE,
): string {
  const d = toDate(value);
  if (!d) return "—";
  return dateFormatter(
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    locale,
  ).format(d);
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
  return formatDate(d, locale);
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

/** Em dash for empty table cells and null values */
export function dash(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
}

/** Re-export for backward compatibility with marketing components */
export { formatMoney as formatMoneyUsd };
