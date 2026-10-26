import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lot } from "./lots.js";
import { sale } from "./sales.js";

/**
 * One row per LAX sale pushed to the ATG (GAP) White Label. The worker owns sync state; staff
 * settings (`auction_type`, `distribution`, `settings_*`) are written by the admin API.
 */
export const atgAuctionLink = pgTable(
  "atg_auction_link",
  {
    saleId: uuid("sale_id")
      .primaryKey()
      .references(() => sale.id, { onDelete: "cascade" }),
    /** GAP `AuctionId` (GUID); null until `CreateAuction` succeeds. */
    atgAuctionId: text("atg_auction_id"),
    /** Value sent as `ClientsAuctionId` so ATG staff can find the sale. */
    atgAuctionReference: text("atg_auction_reference"),
    /** LAX-side lifecycle: pending | created | approved | published | closed. */
    remoteStatus: text("remote_status").notNull().default("pending"),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    payloadHash: text("payload_hash"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date", withTimezone: true }),
    lastPolledAt: timestamp("last_polled_at", { mode: "date", withTimezone: true }),
    lastError: text("last_error"),
    /** Latest `GetSaleResults` rows (no bidder contact details). */
    resultsSnapshot: jsonb("results_snapshot").$type<unknown[]>(),
    /** `Timed` | `Live`; fixed once the ATG auction exists. */
    auctionType: text("auction_type").notNull().default("Timed"),
    /** `private_test` | `public_marketplace`; mapped to `AuctionListings[].Private`. */
    distribution: text("distribution").notNull().default("private_test"),
    settingsUpdatedAt: timestamp("settings_updated_at", { mode: "date", withTimezone: true }),
    settingsUpdatedBy: text("settings_updated_by"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("atg_auction_link_remote_status_idx").on(table.remoteStatus),
    check("atg_auction_link_auction_type_check", sql`${table.auctionType} IN ('Timed', 'Live')`),
    check(
      "atg_auction_link_distribution_check",
      sql`${table.distribution} IN ('private_test', 'public_marketplace')`,
    ),
  ],
);

/** One row per LAX lot created on ATG. Deleted once the ATG lot is deleted. */
export const atgLotLink = pgTable(
  "atg_lot_link",
  {
    lotId: uuid("lot_id")
      .primaryKey()
      .references(() => lot.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => atgAuctionLink.saleId, { onDelete: "cascade" }),
    /** GAP `LotId` (GUID). */
    atgLotId: text("atg_lot_id").notNull(),
    /** `ImageName` values already sent via `AddUrlImageToLot`. */
    imageNames: jsonb("image_names").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    payloadHash: text("payload_hash"),
    /** Hash of the fields ATG locks after the first bid (description, reserve, estimates, opening). */
    lockedFieldsHash: text("locked_fields_hash"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date", withTimezone: true }),
    lastError: text("last_error"),
    currentMaxBid: numeric("current_max_bid", { precision: 12, scale: 2 }),
    numberOfBids: integer("number_of_bids"),
    sold: boolean("sold"),
    hammerPrice: numeric("hammer_price", { precision: 12, scale: 2 }),
    winningBidderId: text("winning_bidder_id"),
    /** GAP lot `Status` from `v2/GetLots`: 0 waiting, 1 offered, 2 not sold, 4 sold (others stored verbatim). */
    status: text("status"),
    lastPolledAt: timestamp("last_polled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("atg_lot_link_sale_id_idx").on(table.saleId)],
);

export type AtgAuctionLinkRow = typeof atgAuctionLink.$inferSelect;
export type AtgLotLinkRow = typeof atgLotLink.$inferSelect;
