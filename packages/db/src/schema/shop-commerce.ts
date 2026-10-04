import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { domainEvent } from "./domain-events.js";

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
  "partially_refunded",
  "refunded",
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

export const shopPartyKindEnum = pgEnum("shop_party_kind", [
  "person",
  "artist",
  "lax",
  "gallery",
  "broker",
  "marketplace",
]);

export const shopEditionListingStatusEnum = pgEnum("shop_edition_listing_status", [
  "not_authorised",
  "authorised",
  "reserved",
  "held",
  "sold",
  "withdrawn",
]);

export const shopEditionCustodyStatusEnum = pgEnum("shop_edition_custody_status", [
  "unprinted",
  "in_production",
  "qc_failed",
  "stored",
  "in_transit",
  "delivered",
  "collected",
  "with_owner",
  "returned",
]);

export const shopStaffRoleEnum = pgEnum("shop_staff_role", [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
]);

export const shopSaleAuthorityRequestStatusEnum = pgEnum("shop_sale_authority_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const shopDocumentKindEnum = pgEnum("shop_document_kind", [
  "certificate",
  "purchase_invoice",
  "fee_evidence",
  "other",
]);

export const shopDocumentVisibilityEnum = pgEnum("shop_document_visibility", [
  "client",
  "staff",
  "internal",
]);

export const shopPayoutLedgerSourceEnum = pgEnum("shop_payout_ledger_source", [
  "order_line",
  "third_party_sale",
  "original_sale",
]);

export const shopPayeeKindEnum = pgEnum("shop_payee_kind", ["person", "artist", "lax", "gallery"]);

export const shopFulfilmentStatusEnum = pgEnum("shop_fulfilment_status", [
  "pending_production",
  "in_production",
  "awaiting_dispatch",
  "in_transit",
  "ready_for_collection",
  "collected",
  "in_storage",
  "delivered",
  "cancelled",
]);

export const shopProductionTaskStatusEnum = pgEnum("shop_production_task_status", [
  "queued",
  "printing",
  "qc_pending",
  "qc_failed",
  "qc_passed",
  "completed",
  "cancelled",
]);

export const shopRefundStatusEnum = pgEnum("shop_refund_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

export const shopRefundSourceEnum = pgEnum("shop_refund_source", [
  "admin",
  "cancellation",
  "stripe_dashboard",
]);

export const shopAdminCommandStatusEnum = pgEnum("shop_admin_command_status", [
  "in_flight",
  "completed",
]);

export const shopDisputeStatusEnum = pgEnum("shop_dispute_status", [
  "opened",
  "won",
  "lost",
  "closed",
]);

export const shopReturnStatusEnum = pgEnum("shop_return_status", [
  "requested",
  "in_transit",
  "received",
  "cancelled",
]);

export const shopPayeeComplianceStatusEnum = pgEnum("shop_payee_compliance_status", [
  "not_required",
  "pending",
  "verified",
  "blocked",
]);

export const shopStockHoldStatusEnum = pgEnum("shop_stock_hold_status", [
  "active",
  "released",
  "expired",
  "converted",
]);

export const shopThirdPartySaleStatusEnum = pgEnum("shop_third_party_sale_status", [
  "draft",
  "recorded",
  "cancelled",
]);

export const shopSaleFeeStatusEnum = pgEnum("shop_sale_fee_status", [
  "pending",
  "approved",
  "rejected",
]);

export const shopOriginalSaleStatusEnum = pgEnum("shop_original_sale_status", [
  "reserved",
  "deposit_due",
  "invoiced",
  "paid",
  "assigned",
  "cancelled",
]);

export const shopParty = pgTable(
  "shop_party",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    identitySubjectId: text("identity_subject_id"),
    kind: shopPartyKindEnum("kind").default("person").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_party_identity_subject_uid").on(table.identitySubjectId),
    uniqueIndex("shop_party_single_lax_uid").on(table.kind).where(sql`${table.kind} = 'lax'`),
  ],
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
    zohoArtistCode: text("zoho_artist_code"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artist_slug_uid").on(table.slug),
    uniqueIndex("shop_artist_zoho_code_uid").on(table.zohoArtistCode),
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
    printPriceFloorPence: integer("print_price_floor_pence"),
    printSize: text("print_size"),
    printPaper: text("print_paper"),
    printFrame: text("print_frame"),
    zohoProductId: text("zoho_product_id"),
    version: integer("version").default(1).notNull(),
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
    reservedUntil: timestamp("reserved_until", { mode: "date", withTimezone: true }),
    reservedByOrderId: uuid("reserved_by_order_id").references(() => shopOrder.id, {
      onDelete: "set null",
    }),
    listingStatus: shopEditionListingStatusEnum("listing_status")
      .default("not_authorised")
      .notNull(),
    custodyStatus: shopEditionCustodyStatusEnum("custody_status").default("unprinted").notNull(),
    saleAuthorisedAt: timestamp("sale_authorised_at", { mode: "date", withTimezone: true }),
    withdrawnReason: text("withdrawn_reason"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_edition_artwork_number_uid").on(table.artworkId, table.editionNumber),
    index("shop_edition_artwork_idx").on(table.artworkId),
    index("shop_edition_listing_sellable_idx").on(
      table.artworkId,
      table.listingStatus,
      table.saleAuthorisedAt,
      table.editionNumber,
    ),
    index("shop_edition_reserved_by_order_idx").on(table.reservedByOrderId),
  ],
);

export const shopProduct = pgTable(
  "shop_product",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_product_slug_uid").on(table.slug)],
);

export const shopProductVariant = pgTable(
  "shop_product_variant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => shopProduct.id, { onDelete: "restrict" }),
    sku: text("sku").notNull(),
    pricePence: integer("price_pence").notNull(),
    onHand: integer("on_hand").default(0).notNull(),
    reserved: integer("reserved").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_product_variant_sku_uid").on(table.sku),
    check("shop_product_variant_stock_nonnegative", sql`${table.onHand} >= 0`),
    check("shop_product_variant_reserved_nonnegative", sql`${table.reserved} >= 0`),
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
    artworkId: uuid("artwork_id").references(() => shopArtwork.id, { onDelete: "restrict" }),
    productVariantId: uuid("product_variant_id").references(() => shopProductVariant.id, {
      onDelete: "restrict",
    }),
    unitPricePence: integer("unit_price_pence").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_basket_line_basket_artwork_uid")
      .on(table.basketId, table.artworkId)
      .where(sql`${table.artworkId} IS NOT NULL`),
    check("shop_basket_line_quantity_positive", sql`${table.quantity} >= 1`),
    check("shop_basket_line_price_nonnegative", sql`${table.unitPricePence} >= 0`),
    uniqueIndex("shop_basket_line_variant_uid")
      .on(table.basketId, table.productVariantId)
      .where(sql`${table.productVariantId} IS NOT NULL`),
    check(
      "shop_basket_line_target_xor",
      sql`((${table.artworkId} IS NOT NULL)::int + (${table.productVariantId} IS NOT NULL)::int) = 1`,
    ),
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
    deliveryRecipientName: text("delivery_recipient_name"),
    deliveryPhone: text("delivery_phone"),
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
    editionId: uuid("edition_id").references(() => shopEdition.id, { onDelete: "restrict" }),
    productVariantId: uuid("product_variant_id").references(() => shopProductVariant.id, {
      onDelete: "restrict",
    }),
    artworkId: uuid("artwork_id").references(() => shopArtwork.id, { onDelete: "restrict" }),
    vatTreatment: text("vat_treatment"),
    vatRateBp: integer("vat_rate_bp"),
    vatPence: integer("vat_pence"),
    sellerPartyId: uuid("seller_party_id").references(() => shopParty.id, { onDelete: "restrict" }),
    editionNumber: integer("edition_number"),
    unitPricePence: integer("unit_price_pence").notNull(),
    releasedAt: timestamp("released_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_order_line_edition_active_uid")
      .on(table.editionId)
      .where(sql`${table.releasedAt} is null`),
    index("shop_order_line_order_idx").on(table.orderId),
    check("shop_order_line_price_nonnegative", sql`${table.unitPricePence} >= 0`),
    check(
      "shop_order_line_target_xor",
      sql`((${table.editionId} IS NOT NULL)::int + (${table.productVariantId} IS NOT NULL)::int) = 1`,
    ),
  ],
);

export const shopPayoutLedger = pgTable(
  "shop_payout_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineId: uuid("order_line_id").references(() => shopOrderLine.id, { onDelete: "restrict" }),
    thirdPartySaleId: uuid("third_party_sale_id").references(() => shopThirdPartySale.id, {
      onDelete: "restrict",
    }),
    originalSaleId: uuid("original_sale_id").references(() => shopOriginalSale.id, {
      onDelete: "restrict",
    }),
    ownerPartyId: uuid("owner_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    grossPence: integer("gross_pence").notNull(),
    deductionsPence: integer("deductions_pence").default(0).notNull(),
    netPence: integer("net_pence").notNull(),
    payoutDueAt: timestamp("payout_due_at", { mode: "date", withTimezone: true }).notNull(),
    status: shopPayoutStatusEnum("status").default("pending_refund_period").notNull(),
    source: shopPayoutLedgerSourceEnum("source").default("order_line").notNull(),
    payeeKind: shopPayeeKindEnum("payee_kind").default("artist").notNull(),
    fundsAvailableAt: timestamp("funds_available_at", { mode: "date", withTimezone: true }),
    cancellationPeriodEndsAt: timestamp("cancellation_period_ends_at", {
      mode: "date",
      withTimezone: true,
    }),
    blockedReason: text("blocked_reason"),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    paidReference: text("paid_reference"),
    paidBySubjectId: text("paid_by_subject_id"),
    version: integer("version").default(1).notNull(),
    arrApplicable: boolean("arr_applicable").default(false).notNull(),
    sellerAcquiredAt: timestamp("seller_acquired_at", { mode: "date", withTimezone: true }),
    sellerAcquisitionSource: text("seller_acquisition_source"),
    laxActedAsAgent: boolean("lax_acted_as_agent"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_payout_ledger_order_line_uid")
      .on(table.orderLineId)
      .where(sql`${table.orderLineId} IS NOT NULL`),
    uniqueIndex("shop_payout_ledger_third_party_sale_uid")
      .on(table.thirdPartySaleId)
      .where(sql`${table.thirdPartySaleId} IS NOT NULL`),
    uniqueIndex("shop_payout_ledger_original_sale_uid")
      .on(table.originalSaleId)
      .where(sql`${table.originalSaleId} IS NOT NULL`),
    index("shop_payout_ledger_status_due_idx").on(table.status, table.payoutDueAt),
    check(
      "shop_payout_ledger_source_fk_check",
      sql`(
        (${table.source} = 'order_line' AND ${table.orderLineId} IS NOT NULL AND ${table.thirdPartySaleId} IS NULL AND ${table.originalSaleId} IS NULL)
        OR (${table.source} = 'third_party_sale' AND ${table.thirdPartySaleId} IS NOT NULL AND ${table.orderLineId} IS NULL AND ${table.originalSaleId} IS NULL)
        OR (${table.source} = 'original_sale' AND ${table.originalSaleId} IS NOT NULL AND ${table.orderLineId} IS NULL AND ${table.thirdPartySaleId} IS NULL)
      )`,
    ),
  ],
);

export const shopProcessedPaymentEvent = pgTable("shop_processed_payment_event", {
  eventId: text("event_id").primaryKey(),
  source: text("source").notNull(),
  processedAt: timestamp("processed_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shopSaleAuthorityGrant = pgTable(
  "shop_sale_authority_grant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    ownerPartyId: uuid("owner_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    authorisedCount: integer("authorised_count").notNull(),
    recordedBySubjectId: text("recorded_by_subject_id").notNull(),
    evidenceNote: text("evidence_note").notNull(),
    requestId: uuid("request_id"),
    revision: bigint("revision", { mode: "number" }).generatedByDefaultAsIdentity().notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "shop_sale_authority_grant_count_range",
      sql`${table.authorisedCount} >= 0 AND ${table.authorisedCount} <= 10`,
    ),
    uniqueIndex("shop_sale_authority_grant_request_uid")
      .on(table.requestId)
      .where(sql`${table.requestId} is not null`),
  ],
);

export const shopSaleAuthorityRequest = pgTable(
  "shop_sale_authority_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    ownerPartyId: uuid("owner_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    requestedCount: integer("requested_count").notNull(),
    note: text("note"),
    status: shopSaleAuthorityRequestStatusEnum("status").default("pending").notNull(),
    handledBySubjectId: text("handled_by_subject_id"),
    handledAt: timestamp("handled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "shop_sale_authority_request_count_range",
      sql`${table.requestedCount} >= 0 AND ${table.requestedCount} <= 10`,
    ),
  ],
);

export const shopEditionEvent = pgTable(
  "shop_edition_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value").notNull(),
    actorSubjectId: text("actor_subject_id"),
    orderId: uuid("order_id").references(() => shopOrder.id, { onDelete: "set null" }),
    holdId: uuid("hold_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_edition_event_edition_idx").on(table.editionId, table.createdAt)],
);

export const shopStaffMember = pgTable(
  "shop_staff_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identitySubjectId: text("identity_subject_id").notNull(),
    role: shopStaffRoleEnum("role").notNull(),
    disabledAt: timestamp("disabled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_staff_member_subject_uid").on(table.identitySubjectId)],
);

export const shopAdminAudit = pgTable(
  "shop_admin_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorSubjectId: text("actor_subject_id").notNull(),
    capability: text("capability").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_admin_audit_created_idx").on(table.createdAt)],
);

export const shopAdminIdempotency = pgTable(
  "shop_admin_idempotency",
  {
    idempotencyKey: text("idempotency_key").notNull(),
    actorSubjectId: text("actor_subject_id").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.idempotencyKey, table.actorSubjectId],
      name: "shop_admin_idempotency_pk",
    }),
  ],
);

export const shopAdminCommand = pgTable(
  "shop_admin_command",
  {
    commandType: text("command_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    actorSubjectId: text("actor_subject_id").notNull(),
    status: shopAdminCommandStatusEnum("status").default("in_flight").notNull(),
    resultJson: jsonb("result_json"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.commandType, table.actorSubjectId, table.idempotencyKey],
      name: "shop_admin_command_pkey",
    }),
    index("shop_admin_command_created_at_idx").on(table.createdAt),
  ],
);

export const shopIdentityMergeInbox = pgTable(
  "shop_identity_merge_inbox",
  {
    eventId: bigint("event_id", { mode: "number" })
      .primaryKey()
      .references(() => domainEvent.id, { onDelete: "restrict" }),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_identity_merge_inbox_status_created_idx").on(table.status, table.createdAt),
    check(
      "shop_identity_merge_inbox_status_check",
      sql`${table.status} IN ('pending', 'completed', 'dead', 'failed')`,
    ),
  ],
);

export const shopPartyInvite = pgTable(
  "shop_party_invite",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    acceptedSubjectId: text("accepted_subject_id"),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_party_invite_token_hash_uid").on(table.tokenHash)],
);

export const shopDocument = pgTable(
  "shop_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id").references(() => shopParty.id, { onDelete: "set null" }),
    kind: shopDocumentKindEnum("kind").notNull(),
    objectKey: text("object_key").notNull(),
    visibility: shopDocumentVisibilityEnum("visibility").default("client").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_document_party_idx").on(table.partyId)],
);

export const shopFulfilmentOptionPrice = pgTable(
  "shop_fulfilment_option_price",
  {
    option: shopFulfilmentOptionEnum("option").primaryKey(),
    pricePence: integer("price_pence").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("shop_fulfilment_option_price_nonnegative", sql`${table.pricePence} >= 0`)],
);

export const shopFulfilment = pgTable(
  "shop_fulfilment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "restrict" }),
    option: shopFulfilmentOptionEnum("option").notNull(),
    status: shopFulfilmentStatusEnum("status").default("pending_production").notNull(),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    possessionAt: timestamp("possession_at", { mode: "date", withTimezone: true }),
    storageLocation: text("storage_location"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_fulfilment_order_uid").on(table.orderId),
    index("shop_fulfilment_possession_idx")
      .on(table.possessionAt)
      .where(sql`${table.possessionAt} is not null`),
  ],
);

export const shopProductionTask = pgTable(
  "shop_production_task",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => shopOrderLine.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    status: shopProductionTaskStatusEnum("status").default("queued").notNull(),
    assignedToSubjectId: text("assigned_to_subject_id"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_production_task_order_line_uid").on(table.orderLineId)],
);

export const shopCertificate = pgTable(
  "shop_certificate",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    orderLineId: uuid("order_line_id").references(() => shopOrderLine.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => shopDocument.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_certificate_edition_uid").on(table.editionId)],
);

export const shopRefund = pgTable(
  "shop_refund",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "restrict" }),
    orderLineId: uuid("order_line_id").references(() => shopOrderLine.id, { onDelete: "set null" }),
    amountPence: integer("amount_pence").notNull(),
    status: shopRefundStatusEnum("status").default("pending").notNull(),
    stripeRefundId: text("stripe_refund_id"),
    source: shopRefundSourceEnum("source").default("admin").notNull(),
    submitAttempts: integer("submit_attempts").default(0).notNull(),
    lastError: text("last_error"),
    submittedAt: timestamp("submitted_at", { mode: "date", withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestedBySubjectId: text("requested_by_subject_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_refund_idempotency_uid").on(table.idempotencyKey),
    uniqueIndex("shop_refund_stripe_refund_uid")
      .on(table.stripeRefundId)
      .where(sql`${table.stripeRefundId} IS NOT NULL`),
    check("shop_refund_amount_nonnegative", sql`${table.amountPence} >= 0`),
  ],
);

export const shopDispute = pgTable(
  "shop_dispute",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "restrict" }),
    stripeDisputeId: text("stripe_dispute_id").notNull(),
    status: shopDisputeStatusEnum("status").default("opened").notNull(),
    amountPence: integer("amount_pence").notNull(),
    openedAt: timestamp("opened_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_dispute_stripe_uid").on(table.stripeDisputeId),
    check("shop_dispute_amount_nonnegative", sql`${table.amountPence} >= 0`),
  ],
);

export const shopReturn = pgTable(
  "shop_return",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => shopOrderLine.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    status: shopReturnStatusEnum("status").default("requested").notNull(),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_return_order_line_uid").on(table.orderLineId)],
);

export const shopPayeeCompliance = pgTable(
  "shop_payee_compliance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    status: shopPayeeComplianceStatusEnum("status").default("not_required").notNull(),
    blockedReason: text("blocked_reason"),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
    verifiedBySubjectId: text("verified_by_subject_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shop_payee_compliance_party_uid").on(table.partyId)],
);

export const shopStockHold = pgTable(
  "shop_stock_hold",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    brokerPartyId: uuid("broker_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    clientPartyId: uuid("client_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    status: shopStockHoldStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    note: text("note"),
    createdBySubjectId: text("created_by_subject_id").notNull(),
    releasedAt: timestamp("released_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_stock_hold_edition_active_uid")
      .on(table.editionId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const shopThirdPartySale = pgTable(
  "shop_third_party_sale",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => shopEdition.id, { onDelete: "restrict" }),
    sellerPartyId: uuid("seller_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    buyerPartyId: uuid("buyer_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    brokerPartyId: uuid("broker_party_id").references(() => shopParty.id, { onDelete: "set null" }),
    grossPence: integer("gross_pence").notNull(),
    status: shopThirdPartySaleStatusEnum("status").default("draft").notNull(),
    recordedBySubjectId: text("recorded_by_subject_id").notNull(),
    recordedAt: timestamp("recorded_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_third_party_sale_edition_open_uid")
      .on(table.editionId)
      .where(sql`${table.status} IN ('draft', 'recorded')`),
    check("shop_third_party_sale_gross_nonnegative", sql`${table.grossPence} >= 0`),
  ],
);

export const shopSaleFee = pgTable(
  "shop_sale_fee",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    thirdPartySaleId: uuid("third_party_sale_id")
      .notNull()
      .references(() => shopThirdPartySale.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    amountPence: integer("amount_pence").notNull(),
    vatTreatment: text("vat_treatment"),
    vatRateBp: integer("vat_rate_bp"),
    vatPence: integer("vat_pence"),
    status: shopSaleFeeStatusEnum("status").default("pending").notNull(),
    approvedBySubjectId: text("approved_by_subject_id"),
    approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_sale_fee_sale_idx").on(table.thirdPartySaleId),
    check("shop_sale_fee_amount_nonnegative", sql`${table.amountPence} >= 0`),
  ],
);

export const shopClientAssignment = pgTable(
  "shop_client_assignment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientPartyId: uuid("client_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    brokerSubjectId: text("broker_subject_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_client_assignment_client_broker_uid").on(
      table.clientPartyId,
      table.brokerSubjectId,
    ),
  ],
);

export const shopOriginalSale = pgTable(
  "shop_original_sale",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    buyerPartyId: uuid("buyer_party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    status: shopOriginalSaleStatusEnum("status").default("reserved").notNull(),
    salePricePence: integer("sale_price_pence").notNull(),
    vatTreatment: text("vat_treatment"),
    vatRateBp: integer("vat_rate_bp"),
    vatPence: integer("vat_pence"),
    reservationExpiresAt: timestamp("reservation_expires_at", { mode: "date", withTimezone: true }),
    stripeInvoiceId: text("stripe_invoice_id"),
    recordedBySubjectId: text("recorded_by_subject_id").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_original_sale_artwork_open_uid")
      .on(table.artworkId)
      .where(sql`${table.status} NOT IN ('assigned', 'cancelled')`),
    index("shop_original_sale_artwork_idx").on(table.artworkId),
    index("shop_original_sale_buyer_idx").on(table.buyerPartyId),
    check("shop_original_sale_price_nonnegative", sql`${table.salePricePence} >= 0`),
  ],
);

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
