import type { SubjectExportMoney } from "@auction/identity-contracts";
import { lotPath, salePath } from "@auction/types";

/** Bid stores money as decimal major units in pounds. */
const DEFAULT_CURRENCY = "GBP";

/** Decimal major units ("1234.50") to minor units plus currency, without going through a float. */
export function money(
  decimal: string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): SubjectExportMoney | null {
  if (decimal === null || decimal === undefined || decimal === "") return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const minor = Number(`${whole}${fraction.padEnd(2, "0").slice(0, 2)}`);
  return { minor: sign === "-" ? -minor : minor, currency };
}

export function moneyFromMinor(minor: number, currency: string): SubjectExportMoney {
  return { minor, currency: currency.toUpperCase() };
}

/** ISO 8601 in UTC, or null for a missing date. */
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function isoRequired(date: Date): string {
  return date.toISOString();
}

/** The first word of a name; staff are shown by first name only. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export type PublicRef = { id: string; title: string; url: string };

export function saleRef(
  sale: { id: string; title: string } | null,
  webOrigin: string,
): PublicRef | null {
  return sale
    ? { id: sale.id, title: sale.title, url: new URL(salePath(sale), webOrigin).toString() }
    : null;
}

export function lotRef(
  lot: { id: string; title: string; lotNumber: number | null } | null,
  webOrigin: string,
): (PublicRef & { number: number | null }) | null {
  return lot
    ? {
        id: lot.id,
        number: lot.lotNumber,
        title: lot.title,
        url: new URL(lotPath(lot), webOrigin).toString(),
      }
    : null;
}
