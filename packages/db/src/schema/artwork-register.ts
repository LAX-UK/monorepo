import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * One record per physical artwork, keyed to its Zoho CRM Product and its LAX stock code. Neutral:
 * owned by neither LAX Bid nor Shop, which reach it through the register repository. Zoho owns the
 * catalogue columns and LAX owns the offer state (see packages/artwork-register-contracts). The
 * constraints are in migration 0287; they are repeated here where drizzle-kit needs them.
 */
export const artworkRegister = pgTable(
  "artwork_register",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    zohoProductId: text("zoho_product_id").notNull(),
    stockCode: text("stock_code").notNull(),
    kind: text("kind").$type<"original" | "print">().notNull(),
    sourceOriginalId: uuid("source_original_id").references((): AnyPgColumn => artworkRegister.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    artistZohoId: text("artist_zoho_id"),
    artistName: text("artist_name").notNull(),
    artistCode: text("artist_code").notNull(),
    medium: text("medium"),
    dimensions: text("dimensions"),
    year: integer("year"),
    imageRefs: jsonb("image_refs").$type<string[]>().notNull().default([]),
    /**
     * Where each picture came from in Zoho and which stored copy it became, in Zoho's order.
     * `imageRefs` is always the distinct keys of this list.
     */
    imageSources: jsonb("image_sources")
      .$type<{ zohoFileId: string; fingerprint: string; sha256: string; key: string }[]>()
      .notNull()
      .default([]),
    /** When the pictures were last compared with Zoho's; null until the first check. */
    imagesCheckedAt: timestamp("images_checked_at", { mode: "date", withTimezone: true }),
    catalogueStatus: text("catalogue_status"),
    offerState: text("offer_state")
      .$type<"held" | "lax_art" | "bid_sale" | "private_sale" | "sold" | "withdrawn">()
      .notNull()
      .default("held"),
    offerRefKind: text("offer_ref_kind").$type<
      "shop_artwork" | "bid_lot" | "private_sale" | "gallery_sale"
    >(),
    offerRefId: text("offer_ref_id"),
    zohoModifiedAt: timestamp("zoho_modified_at", { mode: "date", withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("artwork_register_zoho_product_uid").on(table.zohoProductId),
    uniqueIndex("artwork_register_stock_code_uid").on(table.stockCode),
    index("artwork_register_source_original_idx")
      .on(table.sourceOriginalId)
      .where(sql`${table.sourceOriginalId} IS NOT NULL`),
    index("artwork_register_offer_state_idx").on(table.offerState),
    index("artwork_register_images_checked_idx").on(table.imagesCheckedAt),
    index("artwork_register_offer_ref_idx")
      .on(table.offerRefKind, table.offerRefId)
      .where(sql`${table.offerRefId} IS NOT NULL`),
    check("artwork_register_kind_check", sql`${table.kind} IN ('original', 'print')`),
    check("artwork_register_version_check", sql`${table.version} >= 1`),
  ],
);

/** Append-only history of a register record. A trigger refuses updates and deletes. */
export const artworkRegisterEvent = pgTable(
  "artwork_register_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => artworkRegister.id, { onDelete: "restrict" }),
    type: text("type")
      .$type<
        | "created"
        | "offer_moved"
        | "zoho_change_applied"
        | "conflict_recorded"
        | "conflict_resolved"
        | "zoho_writeback_recorded"
        | "move_confirmed"
        | "lax_art_draft_created"
        | "zoho_link_linked"
        | "zoho_link_unlinked"
        | "sold_while_live_raised"
        | "sold_while_live_resolved"
        | "sold_while_live_overridden"
      >()
      .notNull(),
    /** `zoho`, `system`, or `staff:<user id>`. */
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("artwork_register_event_register_idx").on(table.registerId, table.createdAt, table.id),
  ],
);

/** A LAX-owned field that Zoho changed. Never applied; kept with both values for staff. */
export const artworkRegisterConflict = pgTable(
  "artwork_register_conflict",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => artworkRegister.id, { onDelete: "restrict" }),
    field: text("field")
      .$type<"stockCode" | "kind" | "sourceOriginalId" | "offerState">()
      .notNull(),
    zohoValue: jsonb("zoho_value").$type<unknown>(),
    laxValue: jsonb("lax_value").$type<unknown>(),
    status: text("status").$type<"open" | "resolved">().notNull().default("open"),
    resolution: text("resolution").$type<"kept_lax" | "accepted_zoho">(),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
    zohoModifiedAt: timestamp("zoho_modified_at", { mode: "date", withTimezone: true }).notNull(),
    detectedAt: timestamp("detected_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("artwork_register_conflict_open_uid")
      .on(table.registerId, table.field)
      .where(sql`${table.status} = 'open'`),
    index("artwork_register_conflict_open_queue_idx")
      .on(table.detectedAt, table.id)
      .where(sql`${table.status} = 'open'`),
    index("artwork_register_conflict_register_idx").on(table.registerId),
  ],
);

/**
 * Zoho says an artwork is Sold or Reserved while LAX still has it for sale: one "Needs attention"
 * item per artwork and status. `open` pauses new money for the artwork; `overridden` is staff
 * saying it is not sold, kept (with the reason) so the sync does not raise it again; `resolved`
 * is over. The constraints are in migration 0360; they are repeated here where drizzle-kit needs them.
 */
export const artworkRegisterSoldAttention = pgTable(
  "artwork_register_sold_attention",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => artworkRegister.id, { onDelete: "restrict" }),
    zohoProductId: text("zoho_product_id").notNull(),
    zohoStatus: text("zoho_status").$type<"Sold" | "Reserved">().notNull(),
    place: text("place").$type<"lax_art" | "bid_sale" | "bid_reoffer" | "private_sale">().notNull(),
    /** The listing, lot or offer the artwork is still for sale in, when the register names it. */
    placeRefId: text("place_ref_id"),
    /** When Zoho last changed the Product, which is when it was marked. */
    markedAt: timestamp("marked_at", { mode: "date", withTimezone: true }).notNull(),
    status: text("status").$type<"open" | "overridden" | "resolved">().notNull().default("open"),
    resolution: text("resolution").$type<
      "zoho_status_changed" | "withdrawn" | "sold_in_lax" | "replaced" | "staff_override"
    >(),
    resolvedBy: text("resolved_by"),
    overrideReason: text("override_reason"),
    raisedAt: timestamp("raised_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("artwork_register_sold_attention_live_uid")
      .on(table.registerId, table.zohoStatus)
      .where(sql`${table.status} IN ('open', 'overridden')`),
    index("artwork_register_sold_attention_open_idx")
      .on(table.raisedAt, table.id)
      .where(sql`${table.status} = 'open'`),
    index("artwork_register_sold_attention_product_idx")
      .on(table.zohoProductId)
      .where(sql`${table.status} = 'open'`),
    check(
      "artwork_register_sold_attention_status_check",
      sql`${table.status} IN ('open', 'overridden', 'resolved')`,
    ),
  ],
);
