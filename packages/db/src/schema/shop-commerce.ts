import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const shopEditionAllocationEnum = pgEnum("shop_edition_allocation", [
  "original_buyer_entitlement",
  "artist",
  "lax",
]);

export const shopSaleStateEnum = pgEnum("shop_sale_state", [
  "for_sale",
  "price_on_application",
  "sold",
]);

export const shopPlacementSlotEnum = pgEnum("shop_placement_slot", [
  "featured_originals",
  "featured_categories",
  "featured_prints",
  "featured_artists",
]);

export const shopEditionStatusEnum = pgEnum("shop_edition_status", [
  "allocated",
  "available",
  "reserved",
  "sold",
  "in_production",
  "stored",
  "shipped",
  "returned",
]);

export const shopArtworkInterestIntentEnum = pgEnum("shop_artwork_interest_intent", [
  "notify_me",
  "enquiry",
]);

export const shopOrderStatusEnum = pgEnum("shop_order_status", [
  "pending_payment",
  "paid",
  "cancelled",
  "expired",
  "payment_failed",
]);

export const shopFulfilmentOptionEnum = pgEnum("shop_fulfilment_option", [
  "uk_insured_delivery",
  "collect_new_cavendish",
  "collect_brunswick",
  "lax_storage",
  "international_quotation",
]);

export const shopPayoutStatusEnum = pgEnum("shop_payout_status", [
  "pending_refund_period",
  "due",
  "paid",
  "cancelled",
]);

export const shopParty = pgTable(
  "shop_party",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    identitySubjectId: text("identity_subject_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_party_identity_subject_uid").on(table.identitySubjectId)],
);

export const shopArtist = pgTable(
  "shop_artist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    portraitImageUrl: text("portrait_image_url"),
    discipline: text("discipline"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artist_slug_uid").on(table.slug),
    index("shop_artist_created_id_idx").on(table.createdAt, table.id),
  ],
);

export const shopCategory = pgTable(
  "shop_category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    coverImageUrl: text("cover_image_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_category_slug_uid").on(table.slug)],
);

export const shopArtwork = pgTable(
  "shop_artwork",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    primaryImageUrl: text("primary_image_url"),
    dimensions: text("dimensions"),
    yearCreated: integer("year_created"),
    saleState: shopSaleStateEnum("sale_state").default("for_sale").notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => shopArtist.id, { onDelete: "restrict" }),
    eligibleForEditionAllocation: boolean("eligible_for_edition_allocation").notNull(),
    printPricePence: integer("print_price_pence"),
    importKey: text("import_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artwork_slug_uid").on(table.slug),
    uniqueIndex("shop_artwork_import_key_uid").on(table.importKey),
    index("shop_artwork_artist_idx").on(table.artistId),
    index("shop_artwork_created_id_idx").on(table.createdAt, table.id),
  ],
);

export const shopArtworkCategory = pgTable(
  "shop_artwork_category",
  {
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => shopCategory.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.artworkId, table.categoryId], name: "shop_artwork_category_pk" }),
    index("shop_artwork_category_category_idx").on(table.categoryId),
  ],
);

export const shopHomePlacement = pgTable(
  "shop_home_placement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slot: shopPlacementSlotEnum("slot").notNull(),
    position: integer("position").notNull(),
    artworkId: uuid("artwork_id").references(() => shopArtwork.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id").references(() => shopArtist.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => shopCategory.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_home_placement_slot_position_uid").on(table.slot, table.position),
    check("shop_home_placement_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "shop_home_placement_target_arc",
      sql`(
        (
          ${table.slot} IN ('featured_originals', 'featured_prints')
          AND ${table.artworkId} IS NOT NULL
          AND ${table.artistId} IS NULL
          AND ${table.categoryId} IS NULL
        )
        OR (
          ${table.slot} = 'featured_categories'
          AND ${table.artworkId} IS NULL
          AND ${table.artistId} IS NULL
          AND ${table.categoryId} IS NOT NULL
        )
        OR (
          ${table.slot} = 'featured_artists'
          AND ${table.artworkId} IS NULL
          AND ${table.artistId} IS NOT NULL
          AND ${table.categoryId} IS NULL
        )
      )`,
    ),
  ],
);

export const shopEdition = pgTable(
  "shop_edition",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    editionNumber: integer("edition_number").notNull(),
    allocation: shopEditionAllocationEnum("allocation").notNull(),
    ownerPartyId: uuid("owner_party_id").references(() => shopParty.id, { onDelete: "set null" }),
    status: shopEditionStatusEnum("status").default("allocated").notNull(),
    reservedUntil: timestamp("reserved_until", { mode: "date", withTimezone: true }),
    reservedByOrderId: uuid("reserved_by_order_id").references(() => shopOrder.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_edition_artwork_number_uid").on(table.artworkId, table.editionNumber),
    index("shop_edition_artwork_idx").on(table.artworkId),
    index("shop_edition_sellable_idx").on(table.artworkId, table.status, table.ownerPartyId),
    index("shop_edition_reserved_by_order_idx").on(table.reservedByOrderId),
  ],
);

export const shopBasket = pgTable(
  "shop_basket",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    anonymousTokenHash: text("anonymous_token_hash"),
    identitySubjectId: text("identity_subject_id"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    retiredAt: timestamp("retired_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_basket_anon_hash_open_uid")
      .on(table.anonymousTokenHash)
      .where(sql`${table.retiredAt} is null and ${table.anonymousTokenHash} is not null`),
    uniqueIndex("shop_basket_subject_open_uid")
      .on(table.identitySubjectId)
      .where(sql`${table.retiredAt} is null and ${table.identitySubjectId} is not null`),
  ],
);

export const shopBasketLine = pgTable(
  "shop_basket_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    basketId: uuid("basket_id")
      .notNull()
      .references(() => shopBasket.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    unitPricePence: integer("unit_price_pence").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_basket_line_basket_artwork_uid").on(table.basketId, table.artworkId),
    check("shop_basket_line_quantity_positive", sql`${table.quantity} >= 1`),
    check("shop_basket_line_price_nonnegative", sql`${table.unitPricePence} >= 0`),
  ],
);

export const shopOrder = pgTable(
  "shop_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identitySubjectId: text("identity_subject_id").notNull(),
    buyerPartyId: uuid("buyer_party_id").references(() => shopParty.id, { onDelete: "restrict" }),
    status: shopOrderStatusEnum("status").default("pending_payment").notNull(),
    fulfilment: shopFulfilmentOptionEnum("fulfilment").notNull(),
    merchandiseSubtotalPence: integer("merchandise_subtotal_pence").notNull(),
    fulfilmentSurchargePence: integer("fulfilment_surcharge_pence").notNull(),
    totalPence: integer("total_pence").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    refundPeriodEndsAt: timestamp("refund_period_ends_at", { mode: "date", withTimezone: true }),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    checkoutExpiresAt: timestamp("checkout_expires_at", { mode: "date", withTimezone: true }),
    deliveryLine1: text("delivery_line1"),
    deliveryLine2: text("delivery_line2"),
    deliveryCity: text("delivery_city"),
    deliveryPostcode: text("delivery_postcode"),
    deliveryCountry: text("delivery_country"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_order_idempotency_key_uid").on(table.idempotencyKey),
    index("shop_order_subject_idx").on(table.identitySubjectId),
    index("shop_order_subject_created_idx").on(table.identitySubjectId, table.createdAt),
  ],
);

export const shopOrderLine = pgTable(
  "shop_order_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    sellerPartyId: uuid("seller_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    editionNumber: integer("edition_number").notNull(),
    unitPricePence: integer("unit_price_pence").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_order_line_edition_uid").on(table.editionId),
    index("shop_order_line_order_idx").on(table.orderId),
    check("shop_order_line_price_nonnegative", sql`${table.unitPricePence} >= 0`),
  ],
);

export const shopPayoutLedger = pgTable(
  "shop_payout_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => shopOrderLine.id, { onDelete: "restrict" }),
    ownerPartyId: uuid("owner_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    grossPence: integer("gross_pence").notNull(),
    deductionsPence: integer("deductions_pence").default(0).notNull(),
    netPence: integer("net_pence").notNull(),
    payoutDueAt: timestamp("payout_due_at", { mode: "date", withTimezone: true }).notNull(),
    status: shopPayoutStatusEnum("status").default("pending_refund_period").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_payout_ledger_order_line_uid").on(table.orderLineId)],
);

export const shopProcessedPaymentEvent = pgTable("shop_processed_payment_event", {
  eventId: text("event_id").primaryKey(),
  source: text("source").notNull(),
  processedAt: timestamp("processed_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shopArtistRelations = relations(shopArtist, ({ one, many }) => ({
  party: one(shopParty, { fields: [shopArtist.partyId], references: [shopParty.id] }),
  artworks: many(shopArtwork),
  homePlacements: many(shopHomePlacement),
}));

export const shopCategoryRelations = relations(shopCategory, ({ many }) => ({
  artworkCategories: many(shopArtworkCategory),
  homePlacements: many(shopHomePlacement),
}));

export const shopArtworkRelations = relations(shopArtwork, ({ one, many }) => ({
  artist: one(shopArtist, { fields: [shopArtwork.artistId], references: [shopArtist.id] }),
  editions: many(shopEdition),
  artworkCategories: many(shopArtworkCategory),
  homePlacements: many(shopHomePlacement),
}));

export const shopArtworkCategoryRelations = relations(shopArtworkCategory, ({ one }) => ({
  artwork: one(shopArtwork, {
    fields: [shopArtworkCategory.artworkId],
    references: [shopArtwork.id],
  }),
  category: one(shopCategory, {
    fields: [shopArtworkCategory.categoryId],
    references: [shopCategory.id],
  }),
}));

export const shopHomePlacementRelations = relations(shopHomePlacement, ({ one }) => ({
  artwork: one(shopArtwork, {
    fields: [shopHomePlacement.artworkId],
    references: [shopArtwork.id],
  }),
  artist: one(shopArtist, {
    fields: [shopHomePlacement.artistId],
    references: [shopArtist.id],
  }),
  category: one(shopCategory, {
    fields: [shopHomePlacement.categoryId],
    references: [shopCategory.id],
  }),
}));

export const shopEditionRelations = relations(shopEdition, ({ one }) => ({
  artwork: one(shopArtwork, { fields: [shopEdition.artworkId], references: [shopArtwork.id] }),
  ownerParty: one(shopParty, {
    fields: [shopEdition.ownerPartyId],
    references: [shopParty.id],
  }),
}));

export const shopArtworkInterest = pgTable(
  "shop_artwork_interest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    identitySubjectId: text("identity_subject_id").notNull(),
    intent: shopArtworkInterestIntentEnum("intent").default("notify_me").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("shop_artwork_interest_artwork_subject_intent_uid").on(
      table.artworkId,
      table.identitySubjectId,
      table.intent,
    ),
    index("shop_artwork_interest_subject_idx").on(table.identitySubjectId),
  ],
);
