import {
  OFFER_STATES,
  type OfferState,
  WITHDRAWN_DISPLAY_DAYS,
  zohoStatusByOfferState,
} from "@auction/artwork-register-contracts";
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

/**
 * The Status LAX wants, as a SQL expression over `r.offer_state` and `w.withdrawn_at` (when the
 * artwork was withdrawn, null when the history does not say). The values come from the same
 * mapping the writer uses; only the 30-day Withdrawn window is decided here, in the query, with
 * the length the "Where it is" place uses.
 */
function expectedStatus(now: Date): SQL {
  const shown = zohoStatusByOfferState(true);
  const expired = zohoStatusByOfferState(false);
  const windowOpen = sql`(w.withdrawn_at IS NULL OR w.withdrawn_at + make_interval(days => ${WITHDRAWN_DISPLAY_DAYS}) > ${now.toISOString()}::timestamptz)`;
  const branches = OFFER_STATES.map((state: OfferState) =>
    shown[state] === expired[state]
      ? sql`WHEN ${state} THEN ${shown[state]}`
      : sql`WHEN ${state} THEN CASE WHEN ${windowOpen} THEN ${shown[state]} ELSE ${expired[state]} END`,
  );
  return sql`CASE r.offer_state ${sql.join(branches, sql` `)} END`;
}

type CountRow = { total: number };

/**
 * Where Zoho and the register disagree, from the register and the sync's own results. Each list is
 * one page query and one count query; nothing is read row by row.
 */
export class DrizzleZohoDriftReader implements IZohoDriftReader {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

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
      count(this.mismatched()),
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

  /**
   * The originals whose Status in Zoho is not the one LAX wants. Each carries when it was last
   * withdrawn: the newest offer move, when it moved into Withdrawn.
   */
  private mismatched(): SQL {
    const expected = expectedStatus(this.now());
    return sql`
      FROM artwork_register r
      LEFT JOIN LATERAL (
        SELECT CASE WHEN e.payload -> 'to' ->> 'state' = 'withdrawn' THEN e.created_at END AS withdrawn_at
        FROM artwork_register_event e
        WHERE e.register_id = r.id AND e.type = 'offer_moved'
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
      ) w ON true
      WHERE r.kind = 'original' AND r.catalogue_status IS DISTINCT FROM ${expected}
    `;
  }

  async statusMismatches(paging: ZohoDriftPaging): Promise<ZohoDriftPage<StatusMismatchRow>> {
    const from = this.mismatched();
    const expected = expectedStatus(this.now());
    const [rows, total] = await Promise.all([
      this.db.execute(sql`
        SELECT r.id AS "registerId", r.stock_code AS "stockCode", r.title,
          r.artist_name AS "artistName", r.offer_state AS "offerState",
          r.catalogue_status AS "zohoStatus", ${expected} AS "expectedStatus"
        ${from}
        ORDER BY r.stock_code
        LIMIT ${paging.limit} OFFSET ${paging.offset}
      `),
      this.db.execute(sql`SELECT count(*)::int AS total ${from}`),
    ]);
    return { rows: rowsOf<StatusMismatchRow>(rows), total: rowsOf<CountRow>(total)[0]?.total ?? 0 };
  }
}
