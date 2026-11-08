import type { Database } from "@auction/db";
import {
  shopFramingEditionOffer,
  shopFramingOption,
  shopFramingOptionPrice,
} from "@auction/db/schema";
import type { FramingOption } from "@auction/shop-contracts";
import {
  FRAMING_BAND_CODES,
  type FramingFrame,
  type FramingGlazing,
  type FramingHanging,
  type FramingMount,
  type FramingPrices,
  type FramingStatus,
} from "@auction/shop-domain";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import type {
  FramingListReader,
  FramingOptionFields,
  FramingStore,
  StoredFramingOption,
} from "../../application/framing/framing.ports.js";
import { notFound } from "../../errors/shop-api-error.js";

/** A step between two options in the list, so one can later be slotted between without renumbering. */
const SORT_STEP = 10;
const CODES_LOCK = "shop_framing_option.code";

type OptionRow = typeof shopFramingOption.$inferSelect;

async function pricesByOption(
  db: Database,
  optionIds: readonly string[],
): Promise<Map<string, Partial<FramingPrices>>> {
  const byOption = new Map<string, Partial<FramingPrices>>();
  if (optionIds.length === 0) return byOption;
  const rows = await db
    .select()
    .from(shopFramingOptionPrice)
    .where(inArray(shopFramingOptionPrice.optionId, [...optionIds]));
  for (const row of rows) {
    const prices = byOption.get(row.optionId) ?? {};
    prices[row.band as keyof FramingPrices] = row.pricePence;
    byOption.set(row.optionId, prices);
  }
  return byOption;
}

/** Every band has a price (the table is written whole); a gap would be a corrupt row. */
function completePrices(optionId: string, prices: Partial<FramingPrices> | undefined) {
  const complete: Partial<FramingPrices> = {};
  for (const band of FRAMING_BAND_CODES) {
    const price = prices?.[band];
    if (price === undefined) {
      throw new Error(`Framing option ${optionId} has no price for ${band}`);
    }
    complete[band] = price;
  }
  return complete as FramingPrices;
}

function storedFrom(
  row: OptionRow,
  prices: Partial<FramingPrices> | undefined,
): StoredFramingOption {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    frame: row.frame as FramingFrame,
    mount: row.mount as FramingMount,
    glazing: row.glazing as FramingGlazing,
    hanging: row.hanging as FramingHanging,
    leadTimeMinDays: row.leadTimeMinDays,
    leadTimeMaxDays: row.leadTimeMaxDays,
    pricesPence: completePrices(row.id, prices),
    status: row.status as FramingStatus,
    pricesPlaceholder: row.pricesPlaceholder,
    updatedAt: row.updatedAt,
  };
}

async function editionCounts(
  db: Database,
  optionIds: readonly string[],
): Promise<Map<string, number>> {
  if (optionIds.length === 0) return new Map();
  const rows = await db
    .select({ optionId: shopFramingEditionOffer.optionId, editions: count() })
    .from(shopFramingEditionOffer)
    .where(inArray(shopFramingEditionOffer.optionId, [...optionIds]))
    .groupBy(shopFramingEditionOffer.optionId);
  return new Map(rows.map((row) => [row.optionId, row.editions]));
}

function presentOption(stored: StoredFramingOption, editionCount: number): FramingOption {
  const { updatedAt, ...rest } = stored;
  return { ...rest, editionCount, version: updatedAt.toISOString() };
}

/** Every option in catalogue order, with its prices and the editions offering it. */
async function readOptions(db: Database, onlyId?: string): Promise<FramingOption[]> {
  const rows = await db
    .select()
    .from(shopFramingOption)
    .where(onlyId ? eq(shopFramingOption.id, onlyId) : undefined)
    .orderBy(asc(shopFramingOption.sortOrder), asc(shopFramingOption.createdAt));
  const ids = rows.map((row) => row.id);
  const [prices, counts] = await Promise.all([pricesByOption(db, ids), editionCounts(db, ids)]);
  return rows.map((row) =>
    presentOption(storedFrom(row, prices.get(row.id)), counts.get(row.id) ?? 0),
  );
}

export function createDrizzleFramingListReader(db: Database): FramingListReader {
  return { list: async () => ({ items: await readOptions(db) }) };
}

function optionColumns(fields: FramingOptionFields) {
  return {
    name: fields.name,
    frame: fields.frame,
    mount: fields.mount,
    glazing: fields.glazing,
    hanging: fields.hanging,
    leadTimeMinDays: fields.leadTimeMinDays,
    leadTimeMaxDays: fields.leadTimeMaxDays,
    status: fields.status,
    pricesPlaceholder: fields.pricesPlaceholder,
  };
}

async function writePrices(db: Database, optionId: string, prices: FramingPrices) {
  await db
    .insert(shopFramingOptionPrice)
    .values(FRAMING_BAND_CODES.map((band) => ({ optionId, band, pricePence: prices[band] })))
    .onConflictDoUpdate({
      target: [shopFramingOptionPrice.optionId, shopFramingOptionPrice.band],
      set: { pricePence: sql`excluded.price_pence` },
    });
}

/** The catalogue's reads and writes on one transaction's connection. */
export function createDrizzleFramingStore(db: Database): FramingStore {
  return {
    async lock(optionId) {
      const [row] = await db
        .select()
        .from(shopFramingOption)
        .where(eq(shopFramingOption.id, optionId))
        .for("update")
        .limit(1);
      if (!row) return null;
      const prices = await pricesByOption(db, [row.id]);
      return storedFrom(row, prices.get(row.id));
    },

    async lockCodes() {
      await db.execute(sql`select pg_advisory_xact_lock(hashtext(${CODES_LOCK}))`);
    },

    async codeTaken(code) {
      const [row] = await db
        .select({ id: shopFramingOption.id })
        .from(shopFramingOption)
        .where(eq(shopFramingOption.code, code))
        .limit(1);
      return row !== undefined;
    },

    async insert(code, fields) {
      const [row] = await db
        .insert(shopFramingOption)
        .values({
          code,
          ...optionColumns(fields),
          sortOrder: sql`(select coalesce(max(${shopFramingOption.sortOrder}), 0) + ${SORT_STEP} from ${shopFramingOption})`,
        })
        .returning({ id: shopFramingOption.id });
      if (!row) throw new Error("Failed to save the framing option");
      await writePrices(db, row.id, fields.pricesPence);
      return { id: row.id };
    },

    async update(optionId, fields) {
      await db
        .update(shopFramingOption)
        .set({ ...optionColumns(fields), updatedAt: new Date() })
        .where(eq(shopFramingOption.id, optionId));
      await writePrices(db, optionId, fields.pricesPence);
    },

    async get(optionId) {
      const [option] = await readOptions(db, optionId);
      if (!option) throw notFound("Framing option not found");
      return option;
    },
  };
}
