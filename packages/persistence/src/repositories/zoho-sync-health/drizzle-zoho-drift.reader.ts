import { ZOHO_STATUS_FOR_OFFER } from "@auction/artwork-register-contracts";
import type { OfferState } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { type SQL, sql } from "drizzle-orm";
import type {
  IZohoDriftReader,
  ProductWithoutRegisterRow,
  RegisterWithoutProductRow,
  StatusMismatchRow,
  ZohoDriftCounts,
  ZohoDriftPage,
  ZohoDriftPaging,
} from "../../interfaces/zoho-sync-health.js";
import { rowsOf } from "../rows-of.js";

/** Reasons a Product is left out on purpose or is the "deleted in Zoho" case, not a gap in LAX. */
const NOT_A_GAP = ["demo_artist", "not_found_in_zoho"];

/** The Status LAX writes for each place, as a SQL expression over `offer_state`. */
const EXPECTED_STATUS: SQL = sql`CASE r.offer_state ${sql.join(
  Object.entries(ZOHO_STATUS_FOR_OFFER).map(([state, status]) => sql`WHEN ${state} THEN ${status}`),
  sql` `,
)} END`;

type CountRow = { total: number };

/**
 * Where Zoho and the register disagree, from the register and the sync's own results. Each list is
 * one page query and one count query; nothing is read row by row.
 */
export class DrizzleZohoDriftReader implements IZohoDriftReader {
  constructor(private readonly db: Database) {}

  /**
   * Starts from the Products the sync found missing, then keeps those whose newest result is still
   * "missing": a Product that came back has a later result and drops out.
   */
  private static readonly GONE = sql`
    FROM (
      SELECT DISTINCT zoho_product_id FROM zoho_artwork_sync_outcome
      WHERE outcome = 'skipped' AND reason = 'not_found_in_zoho'
    ) gone
    JOIN artwork_register r ON r.zoho_product_id = gone.zoho_product_id
    JOIN LATERAL (
      SELECT o.outcome, o.reason, o.recorded_at
      FROM zoho_artwork_sync_outcome o
      WHERE o.zoho_product_id = gone.zoho_product_id
      ORDER BY o.recorded_at DESC, o.id DESC
      LIMIT 1
    ) latest ON latest.outcome = 'skipped' AND latest.reason = 'not_found_in_zoho'
  `;

  async counts(): Promise<ZohoDriftCounts> {
    const count = async (from: SQL) =>
      rowsOf<CountRow>(await this.db.execute(sql`SELECT count(*)::int AS total ${from}`))[0]
        ?.total ?? 0;
    const [registerWithoutProduct, productsWithoutRegister, statusMismatches] = await Promise.all([
      count(DrizzleZohoDriftReader.GONE),
      count(DrizzleZohoDriftReader.UNREGISTERED),
      count(DrizzleZohoDriftReader.MISMATCHED),
    ]);
    return { registerWithoutProduct, productsWithoutRegister, statusMismatches };
  }

  async registerWithoutProduct(
    paging: ZohoDriftPaging,
  ): Promise<ZohoDriftPage<RegisterWithoutProductRow>> {
    const [rows, total] = await Promise.all([
      this.db.execute(sql`
        SELECT r.id AS "registerId", r.zoho_product_id AS "zohoProductId",
          r.stock_code AS "stockCode", r.title, r.artist_name AS "artistName",
          r.offer_state AS "offerState", latest.recorded_at AS "foundAt"
        ${DrizzleZohoDriftReader.GONE}
        ORDER BY latest.recorded_at DESC, r.stock_code
        LIMIT ${paging.limit} OFFSET ${paging.offset}
      `),
      this.db.execute(sql`SELECT count(*)::int AS total ${DrizzleZohoDriftReader.GONE}`),
    ]);
    return {
      rows: rowsOf<
        Omit<RegisterWithoutProductRow, "foundAt" | "offerState"> & {
          foundAt: string | Date;
          offerState: OfferState;
        }
      >(rows).map((row) => ({ ...row, foundAt: new Date(row.foundAt) })),
      total: rowsOf<CountRow>(total)[0]?.total ?? 0,
    };
  }

  /**
   * The newest result of every Product LAX has no entry for, kept when that result is a skip that
   * names a gap or, in a dry run, a Product that would be added.
   */
  private static readonly UNREGISTERED = sql`
    FROM (
      SELECT DISTINCT ON (o.zoho_product_id)
        o.zoho_product_id, o.stock_code, o.title, o.outcome, o.reason, o.mode, o.recorded_at
      FROM zoho_artwork_sync_outcome o
      WHERE NOT EXISTS (SELECT 1 FROM artwork_register r WHERE r.zoho_product_id = o.zoho_product_id)
      ORDER BY o.zoho_product_id, o.recorded_at DESC, o.id DESC
    ) latest
    WHERE (latest.outcome = 'skipped' AND latest.reason NOT IN (${sql.join(
      NOT_A_GAP.map((reason) => sql`${reason}`),
      sql`, `,
    )}))
      OR (latest.outcome = 'create' AND latest.mode = 'dry_run')
  `;

  async productsWithoutRegister(
    paging: ZohoDriftPaging,
  ): Promise<ZohoDriftPage<ProductWithoutRegisterRow>> {
    const [rows, total] = await Promise.all([
      this.db.execute(sql`
        SELECT latest.zoho_product_id AS "zohoProductId", latest.stock_code AS "stockCode",
          latest.title, latest.reason, latest.outcome, latest.recorded_at AS "foundAt"
        ${DrizzleZohoDriftReader.UNREGISTERED}
        ORDER BY latest.recorded_at DESC, latest.zoho_product_id
        LIMIT ${paging.limit} OFFSET ${paging.offset}
      `),
      this.db.execute(sql`SELECT count(*)::int AS total ${DrizzleZohoDriftReader.UNREGISTERED}`),
    ]);
    return {
      rows: rowsOf<{
        zohoProductId: string;
        stockCode: string | null;
        title: string | null;
        reason: string | null;
        outcome: "skipped" | "create";
        foundAt: string | Date;
      }>(rows).map((row) => ({
        zohoProductId: row.zohoProductId,
        stockCode: row.stockCode,
        title: row.title,
        reason: row.outcome === "skipped" ? row.reason : null,
        foundAt: new Date(row.foundAt),
      })),
      total: rowsOf<CountRow>(total)[0]?.total ?? 0,
    };
  }

  private static readonly MISMATCHED = sql`
    FROM artwork_register r
    WHERE r.kind = 'original' AND r.catalogue_status IS DISTINCT FROM ${EXPECTED_STATUS}
  `;

  async statusMismatches(paging: ZohoDriftPaging): Promise<ZohoDriftPage<StatusMismatchRow>> {
    const [rows, total] = await Promise.all([
      this.db.execute(sql`
        SELECT r.id AS "registerId", r.stock_code AS "stockCode", r.title,
          r.artist_name AS "artistName", r.offer_state AS "offerState",
          r.catalogue_status AS "zohoStatus", ${EXPECTED_STATUS} AS "expectedStatus"
        ${DrizzleZohoDriftReader.MISMATCHED}
        ORDER BY r.stock_code
        LIMIT ${paging.limit} OFFSET ${paging.offset}
      `),
      this.db.execute(sql`SELECT count(*)::int AS total ${DrizzleZohoDriftReader.MISMATCHED}`),
    ]);
    return { rows: rowsOf<StatusMismatchRow>(rows), total: rowsOf<CountRow>(total)[0]?.total ?? 0 };
  }
}
