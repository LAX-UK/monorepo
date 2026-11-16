import type { Database } from "@auction/db";
import {
  collectionStorageExtension,
  collectionStorageTerms,
  collectionStorageWaiver,
} from "@auction/db/schema";
import { type StorageCountMode, type StorageTerms, storageTermsOf } from "@auction/domain";
import { inArray, sql } from "drizzle-orm";

/** The storage terms a lot was sold under, in the domain's own shape. */
export type SoldUnderTerms = StorageTerms;

/** What prices one lot's storage beyond where it waits: its terms, band, extensions and waiver. */
export type LotStoragePricing = {
  /**
   * The terms recorded when the lot's sale closed; `null` for a lot won before the first terms,
   * which the caller prices with `storageTermsForLot` (`LEGACY_STORAGE_TERMS`).
   */
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
 * there are. A lot with no recorded terms comes back with `terms: null`; the caller applies the
 * legacy terms (30 calendar days free, nothing charged) through `storageTermsForLot`.
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
    // The column is checked to 'calendar' or 'working'; a value outside that is passed on as
    // stored, so the rules refuse it for that lot rather than price it as calendar days.
    terms.map((t) => [t.id, storageTermsOf({ ...t, countMode: t.countMode as StorageCountMode })]),
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
