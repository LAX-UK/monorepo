import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { shopArtwork } from "./shop-commerce.js";

/**
 * The framing catalogue: ready-made framing options LAX Shop can offer on editions. The allowed
 * values for frame, mount, glazing, hanging, status and size band mirror the lists in
 * `@auction/shop-domain` (`framing.ts`); the checks keep a stray value out of the table.
 */
export const shopFramingOption = pgTable(
  "shop_framing_option",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** A short stable name for the option, used when it is mirrored to other systems. */
    code: text("code").notNull().unique(),
    /** The name shoppers see. */
    name: text("name").notNull(),
    frame: text("frame").notNull(),
    mount: text("mount").notNull(),
    glazing: text("glazing").notNull(),
    hanging: text("hanging").notNull(),
    /** Working days, added to the delivery or collection date. */
    leadTimeMinDays: integer("lead_time_min_days").notNull(),
    leadTimeMaxDays: integer("lead_time_max_days").notNull(),
    /** Draft until first offered, then active or paused. */
    status: text("status").notNull().default("draft"),
    /** Where the option sits in the catalogue list; new options go last. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "shop_framing_option_frame_ck",
      sql`${table.frame} IN ('black_wood', 'white_wood', 'natural_oak')`,
    ),
    check(
      "shop_framing_option_mount_ck",
      sql`${table.mount} IN ('window_conservation', 'float_conservation')`,
    ),
    check("shop_framing_option_glazing_ck", sql`${table.glazing} IN ('uv_acrylic')`),
    check("shop_framing_option_hanging_ck", sql`${table.hanging} IN ('d_rings_cord')`),
    check("shop_framing_option_status_ck", sql`${table.status} IN ('draft', 'active', 'paused')`),
    check(
      "shop_framing_option_lead_time_ck",
      sql`${table.leadTimeMinDays} >= 1 AND ${table.leadTimeMaxDays} >= ${table.leadTimeMinDays}`,
    ),
    index("shop_framing_option_status_idx").on(table.status, table.sortOrder),
  ],
);

/** One price per option and size band, in pence including VAT. */
export const shopFramingOptionPrice = pgTable(
  "shop_framing_option_price",
  {
    optionId: uuid("option_id")
      .notNull()
      .references(() => shopFramingOption.id, { onDelete: "cascade" }),
    band: text("band").notNull(),
    pricePence: integer("price_pence").notNull(),
    /**
     * True while this price is the launch placeholder. An option with any placeholder band cannot
     * be offered; triggers in migration 0331 hold that in the database.
     */
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.optionId, table.band] }),
    check(
      "shop_framing_option_price_band_ck",
      sql`${table.band} IN ('up_to_40x50', 'up_to_60x80', 'up_to_80x100')`,
    ),
    check("shop_framing_option_price_positive_ck", sql`${table.pricePence} > 0`),
  ],
);

/**
 * An edition offering an option. The override, when set, is the price for this edition's size band
 * in place of the catalogue price. Staff set these on the edition (a later release); the catalogue
 * counts them as "used on".
 */
export const shopFramingEditionOffer = pgTable(
  "shop_framing_edition_offer",
  {
    optionId: uuid("option_id")
      .notNull()
      .references(() => shopFramingOption.id, { onDelete: "restrict" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    priceOverridePence: integer("price_override_pence"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.optionId, table.artworkId] }),
    check(
      "shop_framing_edition_offer_override_ck",
      sql`${table.priceOverridePence} IS NULL OR ${table.priceOverridePence} > 0`,
    ),
    index("shop_framing_edition_offer_artwork_idx").on(table.artworkId),
  ],
);
