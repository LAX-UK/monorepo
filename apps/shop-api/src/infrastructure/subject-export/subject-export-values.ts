import type { SubjectExportMoney } from "@auction/identity-contracts";
import { type StorefrontOrigins, artworkPublicUrl } from "../../domain/storefront-origins.js";

/** Shop and lax.art price everything in pounds, held as whole pence. */
const CURRENCY = "GBP";

export function pence(amount: number | null | undefined): SubjectExportMoney | null {
  return amount === null || amount === undefined ? null : { minor: amount, currency: CURRENCY };
}

/** ISO 8601 in UTC, or null for a missing date. */
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function isoRequired(date: Date): string {
  return date.toISOString();
}

/**
 * How a value that was erased on request reads in the copy. The erased value is never rebuilt from
 * another table, and a field with nothing to show is not marked: only erased data says so.
 */
export function erased(at: Date | null): { erased: true; erasedAt: string | null } {
  return { erased: true, erasedAt: iso(at) };
}

export type WorkRef = { id: string; title: string; url: string | null };

/** The page a work lives on: the storefront of the site that sells it. */
export function workRef(
  work: { id: string; title: string; slug: string | null; salesChannel: "shop" | "art" | null },
  origins: StorefrontOrigins,
): WorkRef {
  return {
    id: work.id,
    title: work.title,
    url:
      work.slug && work.salesChannel
        ? artworkPublicUrl(origins, work.salesChannel, work.slug)
        : null,
  };
}
