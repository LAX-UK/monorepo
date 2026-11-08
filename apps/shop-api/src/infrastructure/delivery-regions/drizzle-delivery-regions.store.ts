import type { Database } from "@auction/db";
import { shopDeliveryRegion, shopDeliveryRestrictedCountry } from "@auction/db/schema";
import { DEFAULT_DELIVERY_REGIONS, type DeliveryRegion } from "@auction/shop-domain";
import { asc, notInArray, sql } from "drizzle-orm";
import type {
  DeliveryRegionsState,
  DeliveryRegionsStore,
} from "../../application/delivery-regions/delivery-regions.ports.js";

/** The regions as saved, with the names the domain gives them, in the domain's order. */
export async function readDeliveryRegions(db: Database): Promise<DeliveryRegionsState> {
  const [rows, restricted] = await Promise.all([
    db.select().from(shopDeliveryRegion),
    db
      .select({ code: shopDeliveryRestrictedCountry.countryCode })
      .from(shopDeliveryRestrictedCountry)
      .orderBy(asc(shopDeliveryRestrictedCountry.countryCode)),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const regions: DeliveryRegion[] = DEFAULT_DELIVERY_REGIONS.flatMap((fallback) => {
    const row = byId.get(fallback.id);
    // The migration seeds all four; a missing row is read as the defaults rather than failing.
    return [
      row
        ? {
            id: fallback.id,
            name: fallback.name,
            standard: { minDays: row.standardMinDays, maxDays: row.standardMaxDays },
            specialist: { minDays: row.specialistMinDays, maxDays: row.specialistMaxDays },
            fixedPricePence: row.fixedPricePence,
          }
        : fallback,
    ];
  });
  return { regions, restrictedCountries: restricted.map((row) => row.code) };
}

/** Reads and writes the delivery settings inside one transaction. */
export function createDrizzleDeliveryRegionsStore(db: Database): DeliveryRegionsStore {
  return {
    read: () => readDeliveryRegions(db),

    async lock() {
      // Both tables are small and edited rarely: one advisory lock for the settings queues saves.
      await db.execute(sql`select pg_advisory_xact_lock(hashtext('shop_delivery_regions'))`);
    },

    async saveRegion({ id, edit, actorSubjectId, at }) {
      await db
        .insert(shopDeliveryRegion)
        .values({
          id,
          standardMinDays: edit.standard.minDays,
          standardMaxDays: edit.standard.maxDays,
          specialistMinDays: edit.specialist.minDays,
          specialistMaxDays: edit.specialist.maxDays,
          fixedPricePence: edit.fixedPricePence,
          updatedAt: at,
          updatedBySubjectId: actorSubjectId,
        })
        .onConflictDoUpdate({
          target: shopDeliveryRegion.id,
          set: {
            standardMinDays: edit.standard.minDays,
            standardMaxDays: edit.standard.maxDays,
            specialistMinDays: edit.specialist.minDays,
            specialistMaxDays: edit.specialist.maxDays,
            fixedPricePence: edit.fixedPricePence,
            updatedAt: at,
            updatedBySubjectId: actorSubjectId,
          },
        });
    },

    async replaceRestrictedCountries(codes) {
      if (codes.length === 0) {
        await db.delete(shopDeliveryRestrictedCountry);
        return;
      }
      await db
        .delete(shopDeliveryRestrictedCountry)
        .where(notInArray(shopDeliveryRestrictedCountry.countryCode, [...codes]));
      await db
        .insert(shopDeliveryRestrictedCountry)
        .values(codes.map((countryCode) => ({ countryCode })))
        .onConflictDoNothing();
    },
  };
}
