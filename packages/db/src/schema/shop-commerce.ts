import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
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

export const shopSalesChannelEnum = pgEnum("shop_sales_channel", ["shop", "art"]);

export const shopArtworkObjectTypeEnum = pgEnum("shop_artwork_object_type", [
  "painting",
  "work_on_paper",
  "sculpture",
  "photography",
  "print",
  "mixed_media",
]);

export const shopArtworkRarityEnum = pgEnum("shop_artwork_rarity", [
  "unique",
  "limited_edition",
  "open_edition",
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

/** Where an enquiry stands in staff triage; shared by general enquiries and artwork enquiries. */
export const shopEnquiryStatusEnum = pgEnum("shop_enquiry_status", [
  "new",
  "in_progress",
  "closed",
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
  "editor",
  "read_only",
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
    heroMediaKey: text("hero_media_key"),
    nationality: text("nationality"),
    birthYear: integer("birth_year"),
    deathYear: integer("death_year"),
    shortBio: text("short_bio"),
    discipline: text("discipline"),
    bio: text("bio"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    zohoArtistCode: text("zoho_artist_code"),
    identitySubjectId: text("identity_subject_id"),
    /** Set when staff retire the artist: hidden from both storefronts, kept for sales history. */
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artist_slug_uid").on(table.slug),
    uniqueIndex("shop_artist_zoho_code_uid").on(table.zohoArtistCode),
    uniqueIndex("shop_artist_identity_subject_uid")
      .on(table.identitySubjectId)
      .where(sql`${table.identitySubjectId} IS NOT NULL`),
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
    medium: text("medium"),
    objectType: shopArtworkObjectTypeEnum("object_type"),
    rarity: shopArtworkRarityEnum("rarity"),
    heightCm: numeric("height_cm", { precision: 8, scale: 2 }),
    widthCm: numeric("width_cm", { precision: 8, scale: 2 }),
    depthCm: numeric("depth_cm", { precision: 8, scale: 2 }),
    hasCertificate: boolean("has_certificate").default(false).notNull(),
    provenance: text("provenance"),
    exhibitionHistory: text("exhibition_history"),
    yearCreated: integer("year_created"),
    saleState: shopSaleStateEnum("sale_state").default("for_sale").notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => shopArtist.id, { onDelete: "restrict" }),
    eligibleForEditionAllocation: boolean("eligible_for_edition_allocation").notNull(),
    isPersonalisedGoods: boolean("is_personalised_goods").default(false).notNull(),
    printPricePence: integer("print_price_pence"),
    importKey: text("import_key").notNull(),
    printPriceFloorPence: integer("print_price_floor_pence"),
    printSize: text("print_size"),
    printPaper: text("print_paper"),
    printFrame: text("print_frame"),
    zohoProductId: text("zoho_product_id"),
    salesChannel: shopSalesChannelEnum("sales_channel").default("shop").notNull(),
    /**
     * For an edition: the original artwork it was made from (sold on lax.art). Lets each page link
     * to the other. Null when the edition has no original in the catalogue.
     */
    sourceOriginalArtworkId: uuid("source_original_artwork_id").references(
      (): AnyPgColumn => shopArtwork.id,
      { onDelete: "set null" },
    ),
    /**
     * The print run this artwork sells (null for an original): kind, role, template, size and
     * who holds the prints. See packages/shop-domain edition-run.ts for the rules.
     */
    runKind: text("run_kind").$type<"limited" | "open">(),
    runRole: text("run_role").$type<"main" | "proof" | "companion">(),
    runTemplate: text("run_template").$type<"lax_standard" | "custom">(),
    runSize: integer("run_size"),
    allocBuyer: integer("alloc_buyer"),
    allocArtist: integer("alloc_artist"),
    allocLax: integer("alloc_lax"),
    /** Open runs: the default share of each new batch owned by the artist; LAX owns the rest. */
    openDefaultArtistPct: integer("open_default_artist_pct"),
    /** Proof and companion listings: the main run they belong to. */
    mainRunArtworkId: uuid("main_run_artwork_id").references((): AnyPgColumn => shopArtwork.id, {
      onDelete: "restrict",
    }),
    proofType: text("proof_type").$type<"ap" | "pp" | "hc">(),
    proofsKeptAp: integer("proofs_kept_ap"),
    proofsKeptPp: integer("proofs_kept_pp"),
    proofsKeptHc: integer("proofs_kept_hc"),
    proofsKeptBat: integer("proofs_kept_bat"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    version: integer("version").default(1).notNull(),
    /**
     * When the artwork went on the storefront; null while it is a draft. Defaults to the insert
     * time so imports and seeds publish as they always have; staff-created artworks start as drafts.
     */
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }).defaultNow(),
    /** Set when staff withdraw the artwork. Rows are never deleted: editions and orders reference them. */
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_artwork_slug_uid").on(table.slug),
    uniqueIndex("shop_artwork_import_key_uid").on(table.importKey),
    index("shop_artwork_artist_idx").on(table.artistId),
    index("shop_artwork_created_id_idx").on(table.createdAt, table.id),
    index("shop_artwork_source_original_idx").on(table.sourceOriginalArtworkId),
    index("shop_artwork_main_run_idx").on(table.mainRunArtworkId),
    check(
      "shop_artwork_source_original_not_self",
      sql`${table.sourceOriginalArtworkId} IS NULL OR ${table.sourceOriginalArtworkId} <> ${table.id}`,
    ),
    // The run rules live in migration 0246 (one named check per rule); they are repeated here
    // only where drizzle-kit needs them to keep the schema and the database in step.
    check(
      "shop_artwork_run_size_ck",
      sql`${table.runKind} IS DISTINCT FROM 'limited' OR (${table.runSize} IS NOT NULL AND ${table.runSize} BETWEEN CASE WHEN ${table.runRole} = 'proof' THEN 1 ELSE 2 END AND 500)`,
    ),
  ],
);

export const shopArtworkImage = pgTable(
  "shop_artwork_image",
  {
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    mediaKey: text("media_key").notNull(),
    position: integer("position").notNull(),
    alt: text("alt"),
    caption: text("caption"),
  },
  (table) => [
    primaryKey({ columns: [table.artworkId, table.position], name: "shop_artwork_image_pk" }),
    uniqueIndex("shop_artwork_image_artwork_media_uid").on(table.artworkId, table.mediaKey),
    index("shop_artwork_image_media_key_idx").on(table.mediaKey),
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
    /** The printed number; null for open-edition prints and proofs (which use proofNumber). */
    editionNumber: integer("edition_number"),
    /**
     * Identifies the print within its run and orders picking. Equal to editionNumber on numbered
     * runs. Every writer sets it; there is no default.
     */
    stockRef: integer("stock_ref").notNull(),
    proofNumber: integer("proof_number"),
    storageLocation: text("storage_location"),
    labelCode: text("label_code"),
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
    uniqueIndex("shop_edition_artwork_stock_ref_uid").on(table.artworkId, table.stockRef),
    uniqueIndex("shop_edition_label_code_uid")
      .on(table.labelCode)
      .where(sql`${table.labelCode} IS NOT NULL`),
    index("shop_edition_listing_sellable_stock_idx").on(
      table.artworkId,
      table.listingStatus,
      table.saleAuthorisedAt,
      table.stockRef,
    ),
    check("shop_edition_stock_ref_positive_ck", sql`${table.stockRef} > 0`),
  ],
);

/**
 * The facts staff confirm about a run: how it is numbered, how it is signed and what certificate
 * comes with it. One row per run; every public sentence is written from it.
 */
export const shopEditionFacts = pgTable(
  "shop_edition_facts",
  {
    artworkId: uuid("artwork_id")
      .primaryKey()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    numbering: text("numbering").$type<"on_print" | "on_certificate" | "none">().notNull(),
    signatureKind: text("signature_kind")
      .$type<"hand_signed" | "plate_signed" | "estate_stamped" | "estate_signed" | "unsigned">()
      .notNull(),
    signatureMedium: text("signature_medium").$type<"pencil" | "ink">(),
    signaturePlace: text("signature_place").$type<"front_lower_margin" | "back">(),
    certificateKind: text("certificate_kind").$type<"none" | "included">().notNull(),
    certificateIssuer: text("certificate_issuer").$type<"artist" | "publisher" | "lax">(),
    certificateForm: text("certificate_form").$type<"paper" | "digital" | "both">(),
    certificateArrives: text("certificate_arrives").$type<"with_print" | "separately">(),
    certificateWithinWeeks: integer("certificate_within_weeks"),
    certificateNumberedToMatch: boolean("certificate_numbered_to_match"),
    certificateNumberedToMatchReason: text("certificate_numbered_to_match_reason"),
    confirmedBySubjectId: text("confirmed_by_subject_id"),
    confirmedAt: timestamp("confirmed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Rules 6 to 8 and the certificate and confirmation shapes are enforced by the named checks
    // in migration 0246; the confirmation pair is repeated here as the schema's own guard.
    check(
      "shop_edition_facts_confirmed_ck",
      sql`(${table.confirmedBySubjectId} IS NULL) = (${table.confirmedAt} IS NULL)`,
    ),
  ],
);

/** One addition of unnumbered prints to an open edition, with the owner split it used. */
export const shopEditionStockBatch = pgTable(
  "shop_edition_stock_batch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "restrict" }),
    firstStockRef: integer("first_stock_ref").notNull(),
    quantity: integer("quantity").notNull(),
    artistCount: integer("artist_count").notNull(),
    laxCount: integer("lax_count").notNull(),
    custodyStatus: shopEditionCustodyStatusEnum("custody_status").notNull(),
    storageLocation: text("storage_location"),
    addedBySubjectId: text("added_by_subject_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_edition_stock_batch_artwork_first_uid").on(
      table.artworkId,
      table.firstStockRef,
    ),
    check(
      "shop_edition_stock_batch_quantity_ck",
      sql`${table.quantity} > 0 AND ${table.firstStockRef} > 0`,
    ),
    check(
      "shop_edition_stock_batch_split_ck",
      sql`${table.artistCount} >= 0 AND ${table.laxCount} >= 0 AND ${table.artistCount} + ${table.laxCount} = ${table.quantity}`,
    ),
  ],
);

export const shopProduct = pgTable(
  "shop_product",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Set when staff withdraw the product from sale. Rows are never deleted: order lines reference them. */
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
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
    /** Set when staff stop selling this variant; its SKU stays reserved because order lines point at it. */
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_product_variant_sku_uid").on(table.sku),
    check("shop_product_variant_stock_nonnegative", sql`${table.onHand} >= 0`),
    check("shop_product_variant_reserved_nonnegative", sql`${table.reserved} >= 0`),
    check("shop_product_variant_reserved_lte_on_hand", sql`${table.reserved} <= ${table.onHand}`),
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
    /**
     * What people quote for the order ("LAX-S-10482"): shoppers, emails, invoices, Stripe and
     * staff. Issued by the database from `shop_order_reference_seq` when the row is inserted.
     */
    reference: text("reference")
      .default(sql`('LAX-S-' || nextval('shop_order_reference_seq')::text)`)
      .notNull(),
    /**
     * The invoice number ("LAX-INV-000124"), set by the `shop_order_invoice_number_trg` trigger from
     * `shop_invoice_counter` in the transaction that sets `paid_at`. Null until the order is paid.
     */
    invoiceNumber: text("invoice_number"),
    /**
     * Who owns the order: a LAX Identity subject, or `guest:<shop_guest_customer.id>` for a guest
     * order until the guest verifies that email on a LAX account and the order is claimed.
     */
    identitySubjectId: text("identity_subject_id").notNull(),
    /** The guest who placed the order; kept after a claim so staff still see how it was placed. */
    guestCustomerId: uuid("guest_customer_id").references((): AnyPgColumn => shopGuestCustomer.id, {
      onDelete: "restrict",
    }),
    buyerPartyId: uuid("buyer_party_id").references(() => shopParty.id, { onDelete: "restrict" }),
    status: shopOrderStatusEnum("status").default("pending_payment").notNull(),
    fulfilment: shopFulfilmentOptionEnum("fulfilment").notNull(),
    merchandiseSubtotalPence: integer("merchandise_subtotal_pence").notNull(),
    fulfilmentSurchargePence: integer("fulfilment_surcharge_pence").notNull(),
    /** VAT included in the delivery charge, at the goods' rate; null when no VAT was recorded. */
    fulfilmentVatPence: integer("fulfilment_vat_pence"),
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
    /**
     * When a guest's personal data was erased on request. The order and its invoice stay for the
     * accounting record, with the buyer's name and address as the invoice shows them.
     */
    personalDataErasedAt: timestamp("personal_data_erased_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** When that kept name and address were purged, once the six-year retention had passed. */
    invoiceDataPurgedAt: timestamp("invoice_data_purged_at", { mode: "date", withTimezone: true }),
    salesChannel: shopSalesChannelEnum("sales_channel").default("shop").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_order_idempotency_key_uid").on(table.idempotencyKey),
    uniqueIndex("shop_order_reference_uid").on(table.reference),
    uniqueIndex("shop_order_invoice_number_uid").on(table.invoiceNumber),
    index("shop_order_subject_idx").on(table.identitySubjectId),
    index("shop_order_subject_created_idx").on(table.identitySubjectId, table.createdAt),
    index("shop_order_status_created_idx").on(table.status, table.createdAt),
    index("shop_order_guest_customer_idx")
      .on(table.guestCustomerId)
      .where(sql`${table.guestCustomerId} IS NOT NULL`),
    index("shop_order_invoice_purge_due_idx")
      .on(table.personalDataErasedAt)
      .where(
        sql`${table.personalDataErasedAt} IS NOT NULL AND ${table.invoiceDataPurgedAt} IS NULL`,
      ),
  ],
);

/**
 * Someone who gave their email at checkout without a LAX account: the guest on their orders, and
 * a Shop lead whether or not they went on to pay. One row per normalised email.
 */
export const shopGuestCustomer = pgTable(
  "shop_guest_customer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Trimmed and lower-cased, so one person is one row. */
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    /** The separate, unticked opt-in at checkout; transactional email never depends on it. */
    marketingConsent: boolean("marketing_consent").default(false).notNull(),
    marketingConsentAt: timestamp("marketing_consent_at", { mode: "date", withTimezone: true }),
    /** Which wording of the opt-in the guest agreed to. */
    marketingConsentVersion: text("marketing_consent_version"),
    firstSeenAt: timestamp("first_seen_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Paid guest orders; zero means the guest gave an email and left (an abandoned checkout). */
    paidOrderCount: integer("paid_order_count").default(0).notNull(),
    firstPaidAt: timestamp("first_paid_at", { mode: "date", withTimezone: true }),
    /** The LAX account that verified this email and took over the guest's orders. */
    claimedSubjectId: text("claimed_subject_id"),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
    /** Where the lead started: Shop guest checkout, or an enquiry on the Shop or lax.art. */
    source: text("source")
      .$type<"shop_checkout" | "shop_enquiry" | "art_enquiry">()
      .default("shop_checkout")
      .notNull(),
    /** First time this guest reached checkout; null for a lead that has only enquired. */
    checkoutStartedAt: timestamp("checkout_started_at", { mode: "date", withTimezone: true }),
    /** Enquiries sent as a guest from this email. */
    enquiryCount: integer("enquiry_count").default(0).notNull(),
    lastEnquiryAt: timestamp("last_enquiry_at", { mode: "date", withTimezone: true }),
    /** Set when staff erased the guest's personal data on request; the row stays as a tombstone. */
    erasedAt: timestamp("erased_at", { mode: "date", withTimezone: true }),
    erasedBySubjectId: text("erased_by_subject_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_guest_customer_email_uid").on(table.email),
    check(
      "shop_guest_customer_source_ck",
      sql`${table.source} IN ('shop_checkout', 'shop_enquiry', 'art_enquiry')`,
    ),
    check("shop_guest_customer_enquiry_count_ck", sql`${table.enquiryCount} >= 0`),
    check(
      "shop_guest_customer_erasure_pair_ck",
      sql`(${table.erasedAt} IS NULL) = (${table.erasedBySubjectId} IS NULL)`,
    ),
    check(
      "shop_guest_customer_email_normalised_ck",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    check("shop_guest_customer_paid_count_ck", sql`${table.paidOrderCount} >= 0`),
    check(
      "shop_guest_customer_consent_record_ck",
      sql`NOT ${table.marketingConsent} OR (${table.marketingConsentAt} IS NOT NULL AND ${table.marketingConsentVersion} IS NOT NULL)`,
    ),
    check(
      "shop_guest_customer_claim_pair_ck",
      sql`(${table.claimedSubjectId} IS NULL) = (${table.claimedAt} IS NULL)`,
    ),
  ],
);

/** How far a shop-api projection has read `domain_events`; one row per projection. */
export const shopProjectionCursor = pgTable("shop_projection_cursor", {
  name: text("name").primaryKey(),
  lastEventId: bigint("last_event_id", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

/**
 * The emailed link that opens one guest order without an account. Only the token's SHA-256 is
 * stored; each link has one purpose and an expiry.
 */
export const shopGuestOrderLink = pgTable(
  "shop_guest_order_link",
  {
    tokenHash: text("token_hash").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "cascade" }),
    purpose: text("purpose").default("order_view").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    lastOpenedAt: timestamp("last_opened_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_guest_order_link_order_idx").on(table.orderId),
    check("shop_guest_order_link_purpose_ck", sql`${table.purpose} IN ('order_view')`),
  ],
);

/** One row: the last invoice number issued. Paying an order takes the next under a row lock. */
export const shopInvoiceCounter = pgTable(
  "shop_invoice_counter",
  {
    id: smallint("id").default(1).primaryKey(),
    lastNumber: integer("last_number").default(0).notNull(),
  },
  (table) => [
    check("shop_invoice_counter_single_row_ck", sql`${table.id} = 1`),
    check("shop_invoice_counter_nonnegative_ck", sql`${table.lastNumber} >= 0`),
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
    /** The run and facts as they were when the order was paid; what the buyer was told. */
    editionFactsSnapshot: jsonb("edition_facts_snapshot").$type<Record<string, unknown>>(),
    /** The print's label at payment, such as "7/24", "AP 2/3" or "OE-0021". */
    printLabel: text("print_label"),
    packConfirmedAt: timestamp("pack_confirmed_at", { mode: "date", withTimezone: true }),
    packConfirmedBy: text("pack_confirmed_by"),
    swappedFromEditionId: uuid("swapped_from_edition_id").references(() => shopEdition.id, {
      onDelete: "restrict",
    }),
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
    check("shop_sale_authority_grant_count_range", sql`${table.authorisedCount} >= 0`),
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
    /** LAX's reason for declining, shown to the seller; the seller's own note stays in `note`. */
    declineReason: text("decline_reason"),
    status: shopSaleAuthorityRequestStatusEnum("status").default("pending").notNull(),
    handledBySubjectId: text("handled_by_subject_id"),
    handledAt: timestamp("handled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("shop_sale_authority_request_count_range", sql`${table.requestedCount} >= 0`),
    uniqueIndex("shop_sale_authority_request_pending_uid")
      .on(table.artworkId, table.ownerPartyId)
      .where(sql`${table.status} = 'pending'`),
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

/**
 * The LAX Admin roles each staff member holds, each for a period. Capabilities are the union of
 * the roles in force; `shop_staff_member.role` keeps the primary one for display. Rows are never
 * deleted: removing or expiring a role sets `ends_at` and records the end.
 */
export const shopStaffRoleAssignment = pgTable(
  "shop_staff_role_assignment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identitySubjectId: text("identity_subject_id")
      .notNull()
      .references(() => shopStaffMember.identitySubjectId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: shopStaffRoleEnum("role").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    grantedBySubjectId: text("granted_by_subject_id"),
    grantedAt: timestamp("granted_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
    /** When the end was recorded (removal or the daily expiry); null while the role runs. */
    endRecordedAt: timestamp("end_recorded_at", { mode: "date", withTimezone: true }),
    /** The Bid event that gave the role, so Bid can tell a request was applied. */
    grantedEventId: bigint("granted_event_id", { mode: "number" }),
    /** The Bid event that ended the role. */
    endedEventId: bigint("ended_event_id", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("shop_staff_role_assignment_open_uidx")
      .on(table.identitySubjectId, table.role)
      .where(sql`${table.endsAt} IS NULL`),
    index("shop_staff_role_assignment_subject_idx").on(table.identitySubjectId),
    index("shop_staff_role_assignment_unrecorded_end_idx")
      .on(table.endsAt)
      .where(sql`${table.endsAt} IS NOT NULL AND ${table.endRecordedAt} IS NULL`),
  ],
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

/** Bid-emitted lax.staff_access.* events awaiting application to shop_staff_member. */
export const shopStaffAccessInbox = pgTable(
  "shop_staff_access_inbox",
  {
    eventId: bigint("event_id", { mode: "number" })
      .primaryKey()
      .references(() => domainEvent.id, { onDelete: "restrict" }),
    eventType: text("event_type")
      .$type<"lax.staff_access.granted" | "lax.staff_access.revoked">()
      .notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_staff_access_inbox_status_created_idx").on(table.status, table.createdAt),
    check(
      "shop_staff_access_inbox_event_type_check",
      sql`${table.eventType} IN ('lax.staff_access.granted', 'lax.staff_access.revoked')`,
    ),
    check(
      "shop_staff_access_inbox_status_check",
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

export const shopPayeeConnectAccount = pgTable(
  "shop_payee_connect_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    /** Stripe platform that owns the connected account; accounts never move between platforms. */
    stripePlatformKey: text("stripe_platform_key").notNull(),
    stripeConnectAccountId: text("stripe_connect_account_id").notNull(),
    chargesEnabled: boolean("charges_enabled").default(false).notNull(),
    payoutsEnabled: boolean("payouts_enabled").default(false).notNull(),
    requirementsCurrentlyDue: jsonb("requirements_currently_due")
      .$type<string[]>()
      .default([])
      .notNull(),
    disabledReason: text("disabled_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_payee_connect_account_party_platform_uid").on(
      table.partyId,
      table.stripePlatformKey,
    ),
    uniqueIndex("shop_payee_connect_account_stripe_uid").on(table.stripeConnectAccountId),
  ],
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
    /** When each stage was first reached, for the buyer's order timeline. */
    productionStartedAt: timestamp("production_started_at", { mode: "date", withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { mode: "date", withTimezone: true }),
    readyForCollectionAt: timestamp("ready_for_collection_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
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
    certificateReference: text("certificate_reference"),
    issuer: text("issuer").$type<"artist" | "publisher" | "lax">(),
    form: text("form").$type<"paper" | "digital" | "both">(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_certificate_edition_uid").on(table.editionId),
    uniqueIndex("shop_certificate_reference_uid")
      .on(table.certificateReference)
      .where(sql`${table.certificateReference} IS NOT NULL`),
  ],
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
    index("shop_refund_order_idx").on(table.orderId),
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
    /** Null for fees created before the creator was recorded. */
    createdBySubjectId: text("created_by_subject_id"),
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
    salesChannel: shopSalesChannelEnum("sales_channel").default("art").notNull(),
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
    /** Null for guest enquiries, which carry `contactEmail` instead. */
    identitySubjectId: text("identity_subject_id"),
    intent: shopArtworkInterestIntentEnum("intent").default("notify_me").notNull(),
    /**
     * Enquiries only: what the sender and staff quote ("E-2041"). The
     * `shop_artwork_interest_reference_trg` trigger takes it from `shop_enquiry_reference_seq`,
     * which general enquiries share, when an enquiry is inserted.
     */
    reference: text("reference"),
    message: text("message"),
    contactPhone: text("contact_phone"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { mode: "date", withTimezone: true }),
    /** Edition alerts only: set when the person stops the alert before it is sent. */
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    /**
     * Edition alerts only: SHA-256 of the unsubscribe token carried by the alert email. The token
     * itself is never stored; it is minted when the email is queued.
     */
    unsubscribeTokenHash: text("unsubscribe_token_hash"),
    /** Triage state; only rows with intent `enquiry` appear in the staff inbox. */
    status: shopEnquiryStatusEnum("status").default("new").notNull(),
    /** Identity subject of the staff member handling it. */
    assigneeSubject: text("assignee_subject"),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    /** Changes with every triage edit; staff pass it back as the optimistic-concurrency version. */
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_artwork_interest_inbox_idx")
      .on(table.status, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.intent} = 'enquiry'`),
    uniqueIndex("shop_artwork_interest_enquiry_subject_uid")
      .on(table.artworkId, table.identitySubjectId)
      .where(sql`${table.intent} = 'enquiry'`),
    // One waiting alert per artwork for an account and for an email address. A sent or stopped
    // alert no longer counts, so the person can ask again when the edition sells out again.
    uniqueIndex("shop_artwork_interest_alert_subject_uid")
      .on(table.artworkId, table.identitySubjectId)
      .where(
        sql`${table.intent} = 'notify_me' AND ${table.notifiedAt} IS NULL AND ${table.cancelledAt} IS NULL`,
      ),
    uniqueIndex("shop_artwork_interest_alert_email_uid")
      .on(table.artworkId, sql`lower(${table.contactEmail})`)
      .where(
        sql`${table.intent} = 'notify_me' AND ${table.notifiedAt} IS NULL AND ${table.cancelledAt} IS NULL`,
      ),
    index("shop_artwork_interest_alert_email_idx")
      .on(sql`lower(${table.contactEmail})`)
      .where(sql`${table.intent} = 'notify_me'`),
    uniqueIndex("shop_artwork_interest_unsubscribe_token_uid")
      .on(table.unsubscribeTokenHash)
      .where(sql`${table.unsubscribeTokenHash} IS NOT NULL`),
    index("shop_artwork_interest_subject_idx").on(table.identitySubjectId),
    uniqueIndex("shop_artwork_interest_reference_uid")
      .on(table.reference)
      .where(sql`${table.reference} IS NOT NULL`),
    index("shop_artwork_interest_guest_email_idx")
      .on(sql`lower(${table.contactEmail})`)
      .where(sql`${table.identitySubjectId} IS NULL AND ${table.intent} = 'enquiry'`),
    check(
      "shop_artwork_interest_reference_ck",
      sql`${table.intent} <> 'enquiry' OR ${table.reference} IS NOT NULL`,
    ),
    check(
      "shop_artwork_interest_alert_columns_ck",
      sql`${table.intent} = 'notify_me' OR (${table.cancelledAt} IS NULL AND ${table.unsubscribeTokenHash} IS NULL)`,
    ),
    check(
      "shop_artwork_interest_subject_or_contact_ck",
      sql`${table.identitySubjectId} IS NOT NULL OR ${table.contactEmail} IS NOT NULL`,
    ),
    check(
      "shop_artwork_interest_closed_at_ck",
      sql`(${table.status} = 'closed') = (${table.closedAt} IS NOT NULL)`,
    ),
  ],
);

/** Internal staff notes on an enquiry. Append-only: shop_app may INSERT and SELECT only. */
export const shopEnquiryNote = pgTable(
  "shop_enquiry_note",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** `general` is shop_general_enquiry, `artwork` is shop_artwork_interest; no FK as it spans both. */
    enquiryKind: text("enquiry_kind").notNull(),
    enquiryId: uuid("enquiry_id").notNull(),
    authorSubject: text("author_subject").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_enquiry_note_enquiry_idx").on(table.enquiryKind, table.enquiryId, table.createdAt),
    check("shop_enquiry_note_kind_ck", sql`${table.enquiryKind} IN ('general', 'artwork')`),
    check("shop_enquiry_note_body_ck", sql`char_length(${table.body}) BETWEEN 1 AND 5000`),
  ],
);

export const shopSavedArtwork = pgTable(
  "shop_saved_artwork",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identitySubjectId: text("identity_subject_id").notNull(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => shopArtwork.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_saved_artwork_subject_artwork_uid").on(
      table.identitySubjectId,
      table.artworkId,
    ),
    index("shop_saved_artwork_subject_idx").on(table.identitySubjectId),
  ],
);

export const shopFollowedArtist = pgTable(
  "shop_followed_artist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identitySubjectId: text("identity_subject_id").notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => shopArtist.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_followed_artist_subject_artist_uid").on(
      table.identitySubjectId,
      table.artistId,
    ),
    index("shop_followed_artist_subject_idx").on(table.identitySubjectId),
  ],
);

export const shopMediaKindEnum = pgEnum("shop_media_kind", [
  "artwork_image",
  "artist_portrait",
  "artist_hero",
  "editorial_cover",
  "editorial_inline",
  "venue_image",
  /** An image an artist uploads with an application; seen only by the applicant and staff. */
  "artist_application_image",
]);

export const shopMediaAssetStatusEnum = pgEnum("shop_media_asset_status", [
  "pending",
  "active",
  "rejected",
]);

export const shopMediaAsset = pgTable(
  "shop_media_asset",
  {
    key: text("key").primaryKey(),
    kind: shopMediaKindEnum("kind").notNull(),
    status: shopMediaAssetStatusEnum("status").default("pending").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurDataUrl: text("blur_data_url"),
    alt: text("alt"),
    createdBySubjectId: text("created_by_subject_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_media_asset_status_kind_idx").on(table.status, table.kind)],
);

/** A table view a LAX Admin staff member saved for a list. Owned by the person, never shared. */
export const shopStaffSavedView = pgTable(
  "shop_staff_saved_view",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerSubjectId: text("owner_subject_id").notNull(),
    listKey: text("list_key").notNull(),
    label: text("label").notNull(),
    query: text("query").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("shop_staff_saved_view_owner_list_label_uid").on(
      table.ownerSubjectId,
      table.listKey,
      table.label,
    ),
    index("shop_staff_saved_view_owner_list_idx").on(table.ownerSubjectId, table.listKey),
  ],
);
