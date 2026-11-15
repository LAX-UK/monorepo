import type { Database } from "@auction/db";
import {
  collectionStorageExtension,
  collectionStorageTerms,
  collectionStorageWaiver,
} from "@auction/db/schema";
import { inArray, sql } from "drizzle-orm";

/** The storage terms a lot was sold under, as the buyer's notice reads them. */
export type SoldUnderTerms = {
  freeDays: number;
  countMode: "calendar" | "working";
  standardDailyPence: number;
  largeDailyPence: number | null;
  handlingFeePence: number;
  /** The first London day the terms apply, `YYYY-MM-DD`. */
  effectiveFrom: string;
};

/** What prices one lot's storage beyond where it waits: its terms, band, extensions and waiver. */
export type LotStoragePricing = {
  /** The terms recorded when the lot's sale closed; `null` for a lot won before the first terms. */
  terms: SoldUnderTerms | null;
  /** Staff marked the work large (any side over 150 cm). */
  large: boolean;
  /** Free days staff added, in total. */
  extensionDays: number;
  /** Finance waived the charges on this lot. */
  waived: boolean;
};

type LotRef = { lotId: string; storageTermsId: string | null; large: boolean };

/**
 * The storage terms, extensions and waiver of each lot, read in three queries however many lots
 * there are. A lot with no recorded terms keeps the legacy rule (the place's free days, nothing
 * charged), which the caller applies.
 */
export async function readLotStoragePricing(
  db: Database,
  lots: readonly LotRef[],
): Promise<Map<string, LotStoragePricing>> {
  const lotIds = lots.map((l) => l.lotId);
  const termsIds = [...new Set(lots.flatMap((l) => (l.storageTermsId ? [l.storageTermsId] : [])))];
  if (lotIds.length === 0) return new Map();
  const [terms, extensions, waivers] = await Promise.all([
    termsIds.length
      ? db
          .select({
            id: collectionStorageTerms.id,
            freeDays: collectionStorageTerms.freeDays,
            countMode: collectionStorageTerms.countMode,
            standardDailyPence: collectionStorageTerms.standardDailyPence,
            largeDailyPence: collectionStorageTerms.largeDailyPence,
            handlingFeePence: collectionStorageTerms.handlingFeePence,
            effectiveFrom: collectionStorageTerms.effectiveFrom,
          })
          .from(collectionStorageTerms)
          .where(inArray(collectionStorageTerms.id, termsIds))
      : Promise.resolve([]),
    db
      .select({
        lotId: collectionStorageExtension.lotId,
        days: sql<number>`sum(${collectionStorageExtension.days})`.mapWith(Number),
      })
      .from(collectionStorageExtension)
      .where(inArray(collectionStorageExtension.lotId, lotIds))
      .groupBy(collectionStorageExtension.lotId),
    db
      .select({ lotId: collectionStorageWaiver.lotId })
      .from(collectionStorageWaiver)
      .where(inArray(collectionStorageWaiver.lotId, lotIds)),
  ]);
  const termsById = new Map(
    terms.map((t) => [
      t.id,
      {
        freeDays: t.freeDays,
        countMode: t.countMode === "working" ? ("working" as const) : ("calendar" as const),
        standardDailyPence: t.standardDailyPence,
        largeDailyPence: t.largeDailyPence,
        handlingFeePence: t.handlingFeePence,
        effectiveFrom: t.effectiveFrom,
      },
    ]),
  );
  const extensionByLot = new Map(extensions.map((e) => [e.lotId, e.days]));
  const waived = new Set(waivers.map((w) => w.lotId));
  return new Map(
    lots.map((l) => [
      l.lotId,
      {
        terms: l.storageTermsId ? (termsById.get(l.storageTermsId) ?? null) : null,
        large: l.large,
        extensionDays: extensionByLot.get(l.lotId) ?? 0,
        waived: waived.has(l.lotId),
      },
    ]),
  );
}
