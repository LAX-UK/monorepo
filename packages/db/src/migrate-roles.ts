import { pathToFileURL } from "node:url";
import pg from "pg";
import { readUserReadCutover } from "./applied-user-read-cutover.js";
import { buildPgConnectionConfig } from "./ssl.js";

const { Client } = pg;

/** Tables Better Auth runs as `auth_app` must have CRUD DML on (never TRUNCATE/REFERENCES/TRIGGER). */
export const AUTH_FULL_TABLES = [
  "user",
  "session",
  /** The earlier ids a sign-in record stands for after a new sign-in took it over; issuer-only. */
  "session_lineage",
  "account",
  "verification",
  "jwks_key",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
  "oidc_rp_session",
  "oidc_backchannel_logout_delivery",
  "ssf_stream",
  "ssf_delivery",
  /** Devices seen at sign-in and durable retries of security side effects, both issuer-only. */
  "auth_known_device",
  "auth_security_effect_outbox",
  /** `twoFactor` plugin backing table used only by the canonical auth issuer. */
  "two_factor",
  /** Passkeys, used only by the canonical auth issuer. The public key never leaves it. */
  "passkey",
] as const;
/** Append-only Identity side effects emitted by apps/auth. */
export const AUTH_INSERT_SELECT_TABLES = ["identity_lifecycle_outbox"] as const;
/** Trigger-maintained access projection; Identity reads it to apply 2FA policy. */
export const AUTH_READ_TABLES = ["identity_access_marker"] as const;
/** Two-step verification policy rows written through Identity's internal API only. */
export const AUTH_POLICY_TABLES = ["identity_mfa_policy"] as const;
/** The LAX-wide address book. Products reach it through the issuer, never directly. */
export const AUTH_ADDRESS_TABLES = ["identity_address"] as const;
/**
 * "Download my data" requests and the manual requests staff log, owned by Identity. Requests
 * change state, so auth_app updates them; the audit trails are append-only. None is ever deleted
 * from, and api_app and worker_app are denied: the Bid API reaches them through Identity's
 * internal routes.
 */
export const AUTH_EXPORT_TABLES = ["subject_data_export", "subject_data_request"] as const;
export const AUTH_EXPORT_AUDIT_TABLES = [
  "subject_data_export_audit",
  "subject_data_request_audit",
] as const;
/**
 * Which Terms and Privacy notice each person accepted when they created their account. Identity
 * only adds rows and reads them: auth_app may INSERT and SELECT, and api_app and worker_app are
 * denied.
 */
export const AUTH_LEGAL_ACCEPTANCE_TABLES = ["subject_legal_acceptance"] as const;
export const AUTH_DENY_TABLES = [
  "email_outbox",
  "email_suppression",
  "external_accounts",
  "bid_identity_directory",
  "bid_user_profile",
] as const;
/** Shop commerce catalogue tables owned by apps/shop-api under shop_app. */
export const SHOP_COMMERCE_TABLES = [
  "shop_catalogue_setting",
  /** The framing catalogue: options, their prices per size band, and the editions offering them. */
  "shop_framing_option",
  "shop_framing_option_price",
  "shop_framing_edition_offer",
  /** How each edition is sold with respect to framing. */
  "shop_edition_framing",
  /** The work on each frame sold with a print. */
  "shop_framing_task",
  "shop_party",
  "shop_artist",
  "shop_artwork",
  "shop_artwork_image",
  "shop_edition",
  "shop_category",
  "shop_artwork_category",
  "shop_home_placement",
  "shop_basket",
  "shop_basket_line",
  "shop_order",
  "shop_order_line",
  "shop_payout_ledger",
  "shop_processed_payment_event",
  "shop_artwork_interest",
  "shop_saved_artwork",
  "shop_followed_artist",
  "shop_media_asset",
  "shop_editorial_venue",
  "shop_editorial_exhibition",
  "shop_editorial_exhibition_artwork",
  "shop_editorial_exhibition_artist",
  "shop_editorial_exhibition_media",
  "shop_editorial_story",
  "shop_editorial_story_artist",
  "shop_editorial_story_artwork",
  "shop_editorial_story_exhibition",
  "shop_editorial_page",
  "shop_help_category",
  "shop_help_article",
  "shop_editorial_placement",
  "shop_general_enquiry",
  "shop_product",
  "shop_product_variant",
  "shop_sale_authority_request",
  "shop_staff_member",
  /** Each LAX Admin role a staff member holds, with its period. */
  "shop_staff_role_assignment",
  "shop_admin_command",
  "shop_identity_merge_inbox",
  "shop_staff_access_inbox",
  "shop_admin_idempotency",
  "shop_party_invite",
  "shop_document",
  "shop_fulfilment_option_price",
  "shop_fulfilment",
  "shop_production_task",
  "shop_certificate",
  "shop_refund",
  "shop_dispute",
  "shop_return",
  "shop_payee_compliance",
  "shop_stock_hold",
  "shop_third_party_sale",
  "shop_sale_fee",
  "shop_client_assignment",
  "shop_original_sale",
  "shop_payee_connect_account",
  /** A staff member's saved list views, written by shop-api only. */
  "shop_staff_saved_view",
  /** The last invoice number issued; the payment that marks an order paid takes the next one. */
  "shop_invoice_counter",
  /** Artists' applications to join the gallery, and the works they send with them. */
  "shop_artist_application",
  "shop_artist_application_work",
  /** What staff confirm about each print run: numbering, signature and certificate. */
  "shop_edition_facts",
  /** A print sold on its own, apart from its run: where it came from and what differs. */
  "shop_print_exception",
  /** Printers and publishers staff pick from when recording a run's facts. */
  "shop_print_party",
  /** Guest checkout: the guest and lead behind guest orders, and their emailed order links. */
  "shop_guest_customer",
  "shop_guest_order_link",
  /** The alert engine for LAX Shop and lax.art: subscribers, topic switches, matches, digests. */
  "shop_alert_subscriber",
  "shop_alert_topic",
  "shop_alert_match",
  "shop_alert_digest",
  "shop_alert_announcement",
  /** How far shop-api has read the shared event log for each of its own projections. */
  "shop_projection_cursor",
  /** Where the Shop delivers: regions with lead times and optional fixed prices, and the countries it does not deliver to. */
  "shop_delivery_region",
  "shop_delivery_restricted_country",
  "shop_delivery_quote",
  /** The picture staff chose to lead the Shop home's first screen. */
  "shop_home_cover",
] as const;

/** Append-only Shop tables: shop_app may INSERT and SELECT only. */
export const SHOP_COMMERCE_APPEND_ONLY_TABLES = [
  "shop_admin_audit",
  "shop_sale_authority_grant",
  "shop_edition_event",
  "shop_enquiry_note",
  "shop_artist_application_event",
  /** Each addition of prints to an open edition; history is never edited. */
  "shop_edition_stock_batch",
] as const;
export const API_DENY_TABLES = [
  /** Sealed Zoho Books OAuth tokens: only the worker, the process that calls Books, may touch them. */
  "zoho_books_connection",
  "user",
  "session",
  "session_lineage",
  "account",
  "verification",
  "two_factor",
  "passkey",
  "jwks_key",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
  "oidc_rp_session",
  "oidc_backchannel_logout_delivery",
  "shop_user_profile",
  "shop_identity_session",
  "shop_logout_token_replay",
  "ssf_stream",
  "ssf_delivery",
  "auth_known_device",
  "auth_security_effect_outbox",
  "identity_lifecycle_outbox",
  "shop_ssf_replay",
  ...AUTH_READ_TABLES,
  ...AUTH_POLICY_TABLES,
  ...AUTH_ADDRESS_TABLES,
  ...AUTH_EXPORT_TABLES,
  ...AUTH_EXPORT_AUDIT_TABLES,
  ...AUTH_LEGAL_ACCEPTANCE_TABLES,
  ...SHOP_COMMERCE_TABLES,
  ...SHOP_COMMERCE_APPEND_ONLY_TABLES,
] as const;
/** Identity-backed read models exposed to the Bid API without write privileges. */
/**
 * `lax_staff_access_directory` and `lax_staff_role_directory` are trigger-maintained (D36); Bid
 * reads LAX Admin roles from them.
 */
export const API_READ_TABLES = [
  "bid_identity_directory",
  "lax_staff_access_directory",
  "lax_staff_role_directory",
] as const;
/** Product-local profile tables owned by apps/api (Bid). */
export const API_PRODUCT_PROFILE_TABLES = ["bid_user_profile"] as const;
export const API_SSF_RECEIVER_TABLES = ["bid_ssf_replay"] as const;
/**
 * What buyers were refunded for a payment: written beside each `payment.refunded` event and read
 * for the invoice document. Append-only, so api_app gets INSERT and SELECT only; shop_app has no
 * access.
 */
export const API_PAYMENT_REFUND_TABLES = ["payment_refund"] as const;
/**
 * Each link, change and removal of a private sale deal's artwork. Append-only, so api_app gets
 * INSERT and SELECT only; no other role has access.
 */
export const API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES = [
  "private_sale_deal_artwork_history",
] as const;

/**
 * The reference each bank-transfer payment shows its sender, kept for after the provider stops
 * showing it. Append-only, so api_app gets INSERT and SELECT only; no other role touches it.
 */
export const API_PAYMENT_TRANSFER_REFERENCE_TABLES = ["payment_transfer_reference"] as const;
/**
 * Each failed or cancelled Stripe refund taken back from a record (migration 0376), the guard
 * that takes one back at most once. Append-only, so api_app gets INSERT and SELECT only; no
 * other role touches it.
 */
export const API_REFUND_REVERSAL_TABLES = ["stripe_refund_reversal"] as const;
/**
 * Accounting documents and their history (migration 0368). The Bid API reads them for the
 * Finance › Accounting page, and puts a refused document back in the queue when staff try it
 * again (the life cycle's requeue: state columns only, never what the document says), adding that
 * move to its history; it changes the per-product source switch that staff routes expose. The
 * worker creates and advances documents, adds to their history and reads the switch. History is
 * append-only: nobody gets UPDATE or DELETE on it (a trigger refuses them for the owner too). No
 * other role has access. Column grants cannot limit the values written, so triggers (migration
 * 0379) hold the API to the requeue itself: a document only from `failed` or a cleared review to
 * `pending`, with no provider document, and a history row only of that requeue, naming who asked.
 */
export const API_ACCOUNTING_READ_TABLES = [
  "accounting_document",
  "accounting_document_event",
] as const;
export const API_ACCOUNTING_REQUEUE_TABLES = ["accounting_document"] as const;
export const API_ACCOUNTING_HISTORY_TABLES = ["accounting_document_event"] as const;
export const API_ACCOUNTING_SETTING_TABLES = ["accounting_source_setting"] as const;
export const WORKER_ACCOUNTING_DOCUMENT_TABLES = ["accounting_document"] as const;
/** The columns the work queue and the transitions write; see `lifecycleColumns` in persistence. */
export const WORKER_ACCOUNTING_DOCUMENT_UPDATE_COLUMNS = [
  "state",
  "attempts",
  "lease_token",
  "lease_expires_at",
  "settles_at",
  "review_lookup",
  "needs_review_reason",
  "provider",
  "provider_id",
  "provider_number",
  "pdf_ref",
  "mismatch_field",
  "mismatch_difference_pence",
  "last_error_class",
  "updated_at",
] as const;
/** What a staff requeue writes: the worker's columns except `provider` (a requeue never sets it). */
export const API_ACCOUNTING_REQUEUE_COLUMNS = WORKER_ACCOUNTING_DOCUMENT_UPDATE_COLUMNS.filter(
  (column) => column !== "provider",
);
export const WORKER_ACCOUNTING_APPEND_ONLY_TABLES = ["accounting_document_event"] as const;
/**
 * LAX's stored copies of issued documents' PDFs (migration 0381). The worker records a copy once
 * and later settles its email once, as queued or skipped (those four columns only; a trigger makes
 * them write-once); the Bid API reads them to show and serve the buyer's invoice. Nobody deletes a
 * copy. No other role has access.
 */
export const WORKER_ACCOUNTING_COPY_TABLES = ["accounting_document_copy"] as const;
export const WORKER_ACCOUNTING_COPY_UPDATE_COLUMNS = [
  "email_queued_at",
  "email_outbox_id",
  "email_skipped_at",
  "email_skip_reason",
] as const;
export const API_ACCOUNTING_COPY_READ_TABLES = ["accounting_document_copy"] as const;
export const WORKER_ACCOUNTING_READ_TABLES = ["accounting_source_setting"] as const;

/**
 * What the accounting projection reads to book a paid Shop order (plan v2, flows 18-20), column by
 * column: the order's invoice number, totals and delivery charge as stored, its lines' prices and
 * VAT as sold, the words the invoice prints (a work's title, a product's, a frame's name as sold),
 * and the buyer's name and email for the Books contact and the invoice email. Nothing that writes.
 * The order's address and phone, the basket and every other Shop table stay denied to the worker.
 */
export const WORKER_SHOP_INVOICE_READ_COLUMNS = [
  [
    "shop_order",
    [
      "id",
      "reference",
      "status",
      "invoice_number",
      "identity_subject_id",
      "guest_customer_id",
      "buyer_party_id",
      "fulfilment",
      "fulfilment_surcharge_pence",
      "fulfilment_vat_pence",
      "total_pence",
      "paid_at",
    ],
  ],
  [
    "shop_order_line",
    [
      "id",
      "order_id",
      "kind",
      "artwork_id",
      "product_variant_id",
      "print_label",
      "edition_number",
      "unit_price_pence",
      "vat_treatment",
      "vat_pence",
      "framing_snapshot",
      "created_at",
    ],
  ],
  ["shop_artwork", ["id", "title"]],
  ["shop_product", ["id", "title"]],
  ["shop_product_variant", ["id", "product_id", "sku"]],
  ["shop_guest_customer", ["id", "email", "name", "erased_at"]],
] as const;

/**
 * What the Shop app reads to show a buyer their invoice card and serve LAX's stored copy of it
 * (Shop invoices, plan v2): a document's state, number and target, its copy's key, and the moment
 * it was issued. Column by column and read only: the document's payload (names, lines), its totals
 * and every write stay denied to shop_app, and the Shop never changes a document.
 */
export const SHOP_ACCOUNTING_READ_COLUMNS = [
  [
    "accounting_document",
    [
      "id",
      "product",
      "legal_entity",
      "kind",
      "lax_reference",
      "target_provider",
      "target_mode",
      "state",
      "provider_number",
      "created_at",
    ],
  ],
  ["accounting_document_copy", ["document_id", "storage_key", "rehearsal", "stored_at"]],
  ["accounting_document_event", ["document_id", "to_state", "occurred_at"]],
  ["accounting_source_setting", ["product", "xero_mode", "books_mode"]],
] as const;
/**
 * What a seller is paid for each sale, fixed when the buyer's invoice is raised (migration 0372).
 * Both payment-raising processes (the API at checkout, the worker at lot end) write the row in the
 * invoice's transaction and read it; nobody deletes it, and settlement may only re-price a held
 * row (see `SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS`). `bid_finance_setting` holds the
 * Bid company's finance settings: both roles read it, and the staff route that changes it gets its
 * own UPDATE grant in the PR that adds the route. No other role has access.
 */
export const SELLER_TERMS_INSERT_SELECT_TABLES = ["sale_seller_terms"] as const;
/**
 * Settlement (the API when staff run it, the worker on its schedule) prices a held sale again once
 * its facts are in place, such as a recorded agreement, and stores the result over the held row
 * (migration 0378). It writes only the figures and how they were made: never which payment, lot or
 * seller the row is for, nor the hammer, premium or old-rule fee fixed when the invoice was raised.
 */
export const SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS = [
  "basis",
  "held_reason",
  "agreement_id",
  "commission_bps",
  "commission_pence",
  "commission_vat_treatment",
  "commission_vat_bps",
  "commission_vat_pence",
  "other_charges",
  "seller_net_pence",
  "rule_version",
  "source",
  "computed_at",
] as const;
export const FINANCE_SETTING_READ_TABLES = ["bid_finance_setting"] as const;
/**
 * The worker reads the signed agreement behind a lot to price the seller's side at lot end, and
 * only the columns the rule needs: not the reserve, the estimates or the recorded-copy details.
 */
export const WORKER_SELLER_TERMS_READ_COLUMNS = [
  [
    "consignment_agreement",
    ["id", "submission_id", "legal_entity_id", "accepted_at", "proposed_at", "commission_percent"],
  ],
] as const;
/** Shop Identity owns only its local Identity projection. */
export const SHOP_PRODUCT_PROFILE_TABLES = [
  "shop_user_profile",
  "shop_identity_session",
  "shop_logout_token_replay",
] as const;
export const SHOP_SSF_RECEIVER_TABLES = ["shop_ssf_replay"] as const;
/** Shop-api enqueues transactional mail via email_outbox (worker relay delivers). */
export const SHOP_EMAIL_OUTBOX_TABLES = ["email_outbox"] as const;
/**
 * The CRM integration's own records, read by LAX Admin's leads view to show whether each lead
 * reached the CRM. shop_app reads them and never writes: the worker owns both.
 */
export const SHOP_CRM_READ_TABLES = ["crm_record_link", "domain_event_delivery"] as const;
/**
 * "Download my data" for LAX Shop reads a person's suppression entry and newsletter sign-ups from
 * the shared mail tables. shop_app reads them and never writes: the worker and the Bid API own them.
 */
export const SHOP_SUBJECT_EXPORT_READ_TABLES = [
  "email_suppression",
  "newsletter_signup_log",
] as const;
/**
 * LAX Admin reviews the artwork register: shop_app reads the records and the Zoho sync results,
 * records a decision on a conflict (SELECT, UPDATE) and the history entry that goes with it
 * (INSERT, SELECT). It never creates or changes a record; the worker and the offer moves do that.
 */
export const SHOP_ARTWORK_REGISTER_READ_TABLES = [
  "artwork_register",
  "zoho_artwork_sync_outcome",
  "zoho_listing_sync_run",
  "zoho_sync_health",
] as const;
export const SHOP_ARTWORK_REGISTER_CONFLICT_TABLES = ["artwork_register_conflict"] as const;
/**
 * "Zoho says Sold" items: LAX Admin reads them (the pause check, the Needs attention list) and
 * decides one ("It is not sold": UPDATE). The worker raises and closes them, so it also INSERTs.
 */
export const SHOP_SOLD_ATTENTION_TABLES = ["artwork_register_sold_attention"] as const;
export const WORKER_SOLD_ATTENTION_TABLES = ["artwork_register_sold_attention"] as const;
/** The staff override closes an item; shop writes nothing else on it. */
export const SHOP_SOLD_ATTENTION_UPDATE_COLUMNS = [
  "status",
  "resolution",
  "resolved_by",
  "override_reason",
  "resolved_at",
] as const;
/** The monitor closes or replaces an item; it never edits what the item points at. */
export const WORKER_SOLD_ATTENTION_UPDATE_COLUMNS = [
  "status",
  "resolution",
  "resolved_by",
  "resolved_at",
] as const;
export const SHOP_ARTWORK_REGISTER_EVENT_TABLES = ["artwork_register_event"] as const;
/**
 * Shop moves an original's offer state through the register (one place at a time across lax.art
 * and LAX Bid): it reads records and updates the offer. History is append-only (see above).
 */
export const SHOP_ARTWORK_REGISTER_OFFER_TABLES = ["artwork_register"] as const;
/** Worker projectors upsert Shop/Bid local projections from Identity domain events. */
export const WORKER_PRODUCT_PROFILE_TABLES = [
  "shop_user_profile",
  "bid_user_profile",
  "bid_identity_directory",
] as const;
/** Tables whose DML must remain unavailable to worker_app. */
export const WORKER_DENY_TABLES = [
  ...AUTH_FULL_TABLES,
  /** The worker reports export progress through Identity's internal route, never to its tables. */
  ...AUTH_EXPORT_TABLES,
  ...AUTH_EXPORT_AUDIT_TABLES,
  ...AUTH_LEGAL_ACCEPTANCE_TABLES,
  ...API_SSF_RECEIVER_TABLES,
  "shop_identity_session",
  "shop_logout_token_replay",
  ...SHOP_SSF_RECEIVER_TABLES,
  ...SHOP_COMMERCE_TABLES,
  ...SHOP_COMMERCE_APPEND_ONLY_TABLES,
] as const;
export const WORKER_READ_TABLES = [
  /** Identity lifecycle outbox relay reads pending rows before inserting into domain_events. */
  "identity_lifecycle_outbox",
  /** Catalogue tables scanned by backfill-media-assets (read image key columns only). */
  "sale",
  "item_submission",
  "category",
  "artist_profile",
  /** Legal Entity Model - worker needs SELECT for projectors */
  "legal_entity",
  "legal_entity_member",
  "legal_entity_payout_method",
  "kyc_verification",
  "artist_alias",
  "admin_review_task",
  /** SoF projectors read case status / exposure for emails and retention job. */
  "source_of_funds",
  /** Compliance emails go to the staff whose roles in force include compliance. */
  "staff_role_assignment",
  /** Absentee replay places bids, which check who may bid for an organisation and its limits. */
  "buyer_agent_authorisation",
  "legal_entity_bidding_limit",
  /** Notifications about an account a person has muted are not delivered to them. */
  "notification_account_mute",
  /** Xero invoices print the organisation's invoice address and PO reference. */
  "legal_entity_invoice_details",
  /** The clean-up of unsent enquiry files keeps the ones an enquiry holds. */
  "marketing_enquiry_attachment",
  /** The CRM projector reads an enquiry by id to build its Zoho lead (the event carries no personal data). */
  "marketing_enquiry",
  /** ... and the artist a private sale enquiry names, for the lead's Interest: Artist. */
  "private_sale_enquiry_detail",
  /** The follow-up projector reads the confirmed choice it opens work for. */
  "unsold_lot_choice",
  /** Lot reads (invoice initiation and other projectors) load each lot's categories. */
  "lot_categories",
  /** The payout statement names the private sale a payout line settles by its PS reference. */
  "private_sale_deal",
  /** The payment expiry job closes each invoice's open Checkout sessions before cancelling it. */
  "payment_checkout_session",
  /** The collection emails name the gallery and its address. */
  "venue",
  /** The collection reminder sweep reads the next day's visits, their lots and the place's rules. */
  "collection_place",
  "collection_weekly_hours",
  "collection_exception",
  "collection_booking",
  "collection_booking_lot",
  /** The storage reminder sweep reads each lot's eligibility to collect: a courier quote accepted, a dispute open. */
  "delivery_quote",
  "dispute_case",
  "dispute_case_candidate",
];
// Postgres requires UPDATE on the target table for `select ... for update` row locks even
// when no rows are mutated. The projector runner pulls events with FOR UPDATE SKIP LOCKED,
// so worker_app needs SELECT + UPDATE on these tables. Keep them out of WORKER_FULL_TABLES
// to deny INSERT/DELETE/TRUNCATE on the append-only event log.
//
// newsletter_signup_log is SELECT+UPDATE: the worker drains rows inserted by apps/api
// but must not insert new ones (apps/api does that) and must not delete (audit trail).
// email_outbox is handled separately below because the worker also enqueues mail from its
// own projectors (notification-fanout, payout-transfer-failed-notify) via
// PostmarkEmailService.enqueue(), which performs an INSERT on idempotency miss.
const WORKER_LOCK_READ_TABLES = [
  "domain_events",
  "newsletter_signup_log",
  /** archive cascade updates bids + draft/scheduled lots. */
  "bid",
  "lot",
  /** Sale lifecycle reconciliation updates umbrella sale status. */
  "sale",
];

/** Bulk payout settlement creates payout + line rows and updates payout transfer state. */
export const WORKER_PAYOUT_SETTLEMENT_TABLES = ["payout", "payout_line"] as const;

/** Stripe Connect readiness sync during settlement updates cached flags + lifecycle status. */
export const WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS = [
  "status",
  "stripe_connect_charges_enabled",
  "stripe_connect_payouts_enabled",
  "stripe_connect_requirements_currently_due",
  "stripe_connect_requirements_errors",
  "stripe_connect_disabled_reason",
  "updated_at",
] as const;
export const WORKER_FULL_TABLES = [
  "projector_state",
  "webhook_event",
  "upload_object",
  /** process-image job upserts; image-cleanup deletes rows. */
  "media_asset",
  /** The cover analysis job writes what it measures from each sale cover picture. */
  "cover_analysis",
  "marketing_click_ids",
  "marketing_attribution",
  /** Zoho CRM sync links platform ids to Zoho record ids. */
  "crm_record_link",
  /** ATG sync jobs upsert links on push and delete lot links after DeleteLot. */
  "atg_auction_link",
  "atg_lot_link",
] as const;
/**
 * The KYC, AML and source-of-funds retention purge reads and deletes these once five years have passed since
 * the relationship ended, and writes a tombstone. Reading what decides "ended" (domain_events, bid,
 * payment, payout, legal_entity) and the file rows (upload_object) is granted elsewhere.
 */
export const WORKER_KYC_RETENTION_PURGE_TABLES = [
  "kyc_verification",
  "kyc_watchlist_screening",
  "source_of_funds",
  "source_of_funds_document",
  "legal_entity_document",
  "admin_review_task",
] as const;
/**
 * The retention purge holds back a person or organisation that is on a private sale deal until the
 * deal's own retention has passed. It reads who was named on each deal and when the deal changed
 * stage (the deal itself and the enquiry are granted elsewhere). Read only.
 */
export const WORKER_KYC_RETENTION_DEAL_READ_TABLES = [
  "private_sale_deal_party",
  "private_sale_deal_party_history",
  "private_sale_deal_stage_history",
] as const;
/**
 * The CSV exports list sales and submissions with their categories, which sit in these join tables.
 * Read only.
 */
export const WORKER_EXPORT_CATEGORY_READ_TABLES = [
  "sale_categories",
  "submission_categories",
] as const;
/** Append-only proof of each purge: no personal data. */
export const WORKER_KYC_RETENTION_TOMBSTONE_TABLES = ["kyc_retention_tombstone"] as const;
/** Worker persists async QR scan events (qr-code-scan job via persistQrCodeScan). */
export const WORKER_QR_CODE_SCAN_TABLES = ["qr_code_scan", "qr_code_scan_daily"] as const;
/**
 * The nightly retention purge (apps/worker, `purge-qr-code-scans`) deletes raw scan rows past
 * retention. The daily roll-up keeps no personal data and is never deleted.
 */
export const WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES = ["qr_code_scan"] as const;
/** The unsold-choice projector stores each unsold outcome's choose-by date, once. */
export const WORKER_UNSOLD_CHOICE_DEADLINE_TABLES = ["unsold_choice_deadline"] as const;
/** The follow-up projector opens the staff work a confirmed unsold-lot choice leaves behind. */
export const WORKER_UNSOLD_FOLLOW_UP_TABLES = ["unsold_lot_follow_up"] as const;

/**
 * The artwork register: the Zoho inbound sync creates and updates records and records conflicts.
 * History is append-only, so the worker may add to it and read it, never change it.
 */
export const WORKER_ARTWORK_REGISTER_TABLES = [
  "artwork_register",
  "artwork_register_conflict",
] as const;
export const WORKER_ARTWORK_REGISTER_APPEND_ONLY_TABLES = ["artwork_register_event"] as const;
/**
 * The Zoho artwork sync keeps its watermark and the result for each Product it reads; the nightly
 * LAX listing pass keeps its summary.
 */
/**
 * The Zoho Campaigns sync upserts into email_suppression, so the worker may rewrite these three
 * columns on a conflict and nothing else (the address hash is the key and is never changed).
 */
export const WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS = ["reason", "source", "created_at"] as const;
/**
 * Erasing a purged person's account touches collection bookings in three ways, and the worker may
 * change only these columns:
 * - a live visit is cancelled (status, who and when it was cancelled, the calendar sequence);
 * - an ended visit loses the collector's email and company, and the name unless it is a hand-over
 *   record that is kept for its retention period;
 * - after that period the retained name and ID type are cleared.
 */
export const WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS = [
  "status",
  "cancelled_at",
  "ics_sequence",
  "updated_at",
  "collector_name",
  "collector_email",
  "collector_company",
  "id_check_type",
  "personal_details_erased_at",
  "handover_record_cleared_at",
] as const;
/** Cancelling a live visit gives its lots back. */
export const WORKER_COLLECTION_LOT_RELEASE_COLUMNS = ["active"] as const;
export const WORKER_ZOHO_CAMPAIGNS_SUPPRESSION_TABLES = [
  "zoho_campaigns_suppression_state",
] as const;
/**
 * The sync reads when each person last asked for mail again. It never writes it: a lift goes
 * through LIFT_ZOHO_CAMPAIGNS_OPT_OUT_FUNCTION, which also removes the opt-out, so neither
 * worker_app nor shop_app needs DELETE on email_suppression.
 */
export const WORKER_ZOHO_CAMPAIGNS_LIFT_READ_TABLES = ["zoho_campaigns_optout_lift"] as const;
/** Migration 0323's definer function; the one writer of a lift. */
export const LIFT_ZOHO_CAMPAIGNS_OPT_OUT_FUNCTION =
  "lift_zoho_campaigns_opt_out(text, timestamptz, boolean)";
/** Roles that may call it: the Bid API (confirm link) and the worker (Shop event, sync, newsletter). */
export const LIFT_ZOHO_CAMPAIGNS_OPT_OUT_ROLES = ["api_app", "worker_app"] as const;
/** Migration 0344's top-up of the buyer refund record from the payout ledger. */
export const PAYMENT_REFUND_BACKFILL_FUNCTION = "payment_refund_backfill_from_payout_lines(uuid)";
/** Roles that may call it: the API (refund webhooks, staff refunds) and the worker. Not shop_app. */
export const PAYMENT_REFUND_BACKFILL_ROLES = ["api_app", "worker_app"] as const;
export const WORKER_ZOHO_ARTWORK_SYNC_TABLES = [
  "zoho_artwork_sync_state",
  "zoho_artwork_sync_outcome",
  "zoho_listing_sync_run",
  "zoho_sync_health",
] as const;
/**
 * Zoho Books connections (sealed OAuth tokens). Only the worker, the process that calls Books, is
 * granted anything, and only by column: it reads the token columns, creates a connection and updates
 * the token and status columns. It never deletes, truncates or rewrites `id`, `organization_id` or
 * `created_at`. `api_app` is denied (API_DENY_TABLES); `shop_app` and `auth_app` get nothing. If a
 * staff "connect Books" route is added to the API later, give it column-level INSERT/UPDATE on the
 * write columns and no SELECT on the sealed ones.
 */
export const WORKER_ZOHO_BOOKS_TABLES = ["zoho_books_connection"] as const;
export const WORKER_ZOHO_BOOKS_SELECT_COLUMNS = [
  "organization_id",
  "refresh_token_sealed",
  "access_token_sealed",
  "access_token_expires_at",
  "connection_status",
  "last_refresh_error_code",
  "updated_at",
] as const;
export const WORKER_ZOHO_BOOKS_INSERT_COLUMNS = WORKER_ZOHO_BOOKS_SELECT_COLUMNS;
export const WORKER_ZOHO_BOOKS_UPDATE_COLUMNS = [
  "refresh_token_sealed",
  "access_token_sealed",
  "access_token_expires_at",
  "connection_status",
  "last_refresh_error_code",
  "updated_at",
] as const;
/**
 * The alert engine's Bid tables: the matching projector records matches and announcements, and the
 * 08:00 digest claims digests, attaches matches and drops stale ones. Nothing is deleted here.
 */
export const WORKER_BID_ALERT_TABLES = [
  "bid_alert_subscriber",
  "bid_alert_topic",
  "bid_alert_match",
  "bid_alert_digest",
  "bid_alert_announcement",
] as const;
/**
 * The retention prune (apps/worker, `purge-alert-retention`) deletes old match and digest logs and
 * trims a complaint-stopped subscriber's topics, matches and digests. Subscribers themselves are
 * deleted through WORKER_ANONYMISATION_DELETE_TABLES. bid_alert_announcement is never deleted.
 */
export const WORKER_BID_ALERT_PRUNE_DELETE_TABLES = [
  "bid_alert_topic",
  "bid_alert_match",
  "bid_alert_digest",
] as const;
/** Worker provisions personal legal entities from `user.registered` domain events. */
export const WORKER_PROVISIONING_TABLES = ["legal_entity", "legal_entity_member"] as const;
/** Worker processes async CSV exports and purges expired rows (data-export + purge-expired jobs). */
export const WORKER_DATA_EXPORT_TABLES = ["data_exports"] as const;

/** Per-consumer delivery ledger (Zoho/Xero projector leases, retry, dead-letter). */
export const WORKER_DOMAIN_EVENT_DELIVERY_TABLES = ["domain_event_delivery"] as const;

/** Worker-local finance cron: expire stale pending/authorized payments. */
export const WORKER_PAYMENT_MAINTENANCE_TABLES = ["payment"] as const;

/**
 * Raising the invoice when a lot is sold, with the same implementation as the API: the payment
 * row, its fulfilment record ("awaiting payment") and, when the amount needs it, a pending
 * source-of-funds case. The invoice and its lines are stored with the payment row. Inserts only;
 * the worker still never deletes any of them.
 */
export const WORKER_INVOICE_RAISE_INSERT_TABLES = [
  "payment",
  "source_of_funds",
  "bid_invoice",
  "bid_invoice_line",
] as const;
/**
 * The refund reconcile job re-applies a staff refund whose ledger update failed, and records the
 * buyer-side refund with it (reading what is recorded first). Never changed or deleted.
 */
export const WORKER_PAYMENT_REFUND_TABLES = ["payment_refund"] as const;
export const WORKER_INVOICE_RAISE_FULFILMENT_TABLES = ["lot_fulfilment"] as const;

/** Worker-local finance cron: Xero OAuth, external refs, webhook replay, refund reconcile. */
export const WORKER_FINANCE_INTEGRATION_TABLES = [
  "xero_connection",
  "payment_external_ref",
  "xero_webhook_event",
  "payment_refund_reconcile",
] as const;

/** Display pairing hygiene cron (expire pending + purge terminal rows). */
export const WORKER_DISPLAY_PAIRING_TABLES = ["saleroom_display_pairing"] as const;

/** Invoice addressing reads during lot invoice initiation. */
export const WORKER_FINANCE_READ_TABLES = ["address"] as const;

/**
 * Re-offers after a buyer default: the sweeps lapse an unanswered seller request, remind the seller
 * and end an offer the bidder let run out, so worker_app reads these tables and updates the
 * columns that say where a request or an offer stands, and nothing else. It never creates, deletes
 * or re-prices an offer, never changes who it is for, and never sets `reawarded_at`: only the
 * re-award transaction, through the API, makes a lot's winner.
 */
export const WORKER_REOFFER_TABLES = ["lot_reoffer", "seller_consent"] as const;
export const WORKER_REOFFER_UPDATE_COLUMNS = {
  lot_reoffer: ["status", "close_reason", "closed_by", "updated_at"],
  /**
   * A lapse is the same write as an answer (`answer`): status, who and how it arrived (nobody, by
   * the clock), when, and the note and preference an answer may carry. The reminder sets
   * `reminded_at`. The request itself (terms, due date, who it is for) is never changed.
   */
  seller_consent: [
    "status",
    "channel",
    "answered_by_user_id",
    "answered_at",
    "note",
    "preferred_next",
    "reminded_at",
  ],
} as const;

/**
 * What the worker reads of the buyer default: which one is the lot's latest, so the re-offer clock
 * never reminds a bidder about an offer a later default has overtaken, and what it decided (offer
 * on or return to inventory), so a public total leaves out a lot whose result is still open. Four
 * columns only; the hammer, the buyer and the reason stay with the API.
 */
export const WORKER_REOFFER_READ_COLUMNS = [
  ["buyer_default", ["id", "lot_id", "created_at", "outcome"]],
] as const;

/** Lot lifecycle notification staging (won/lost) drained by notification outbox cron. */
export const WORKER_NOTIFICATION_OUTBOX_TABLES = ["notification_outbox"] as const;

/** Watchlist reads for lifecycle starting / ending-soon notifications. */
export const WORKER_LIFECYCLE_READ_TABLES = ["watchlist", "saleroom_session"] as const;

/** Worker lifecycle journal upserts during activate/end/bid early-close. */
export const WORKER_LIFECYCLE_SNAPSHOT_TABLES = ["lot_lifecycle_snapshot"] as const;

/** DLQ exhaustion audit rows when worker consumes BullMQ queues. */
export const WORKER_FAILED_JOBS_TABLES = ["failed_jobs"] as const;

/** Worker-local absentee replay and bid placement for lifecycle activation. */
export const WORKER_ABSENTEE_BID_TABLES = ["absentee_bid"] as const;

/** Worker absentee replay inserts bids during activation replay. */
export const WORKER_BID_PLACEMENT_TABLES = ["bid"] as const;

/**
 * Purged-person anonymisation (apps/worker/src/anonymisation). Tables that only describe the
 * person are deleted from; the worker reads them to filter and to count what it removed.
 * marketing_click_ids is already covered by WORKER_FULL_TABLES.
 */
export const WORKER_ANONYMISATION_DELETE_TABLES = [
  "legal_entity_address",
  "legal_entity_invoice_details",
  "user_address",
  "push_subscription",
  "saved_search",
  "watchlist",
  "sale_follow",
  "artist_watchlist",
  "user_category_interest",
  "notification_preference",
  "notification_account_mute",
  "user_ui_preference",
  /** Email-only alert sign-ups: erased by account and by address (cascades to topics, matches, digests). */
  "bid_alert_subscriber",
  "visitor_sale_alert_subscriber",
] as const;

/**
 * Tables the same job keeps but scrubs. UPDATE is granted on the scrubbed columns only, plus
 * SELECT for the filter. bid_user_profile and legal_entity are granted elsewhere, and so are
 * email_outbox and notification_outbox.
 */
export const WORKER_ANONYMISATION_SCRUB_COLUMNS = [
  ["legal_entity", ["display_name", "legal_name", "slug", "vat_number"]],
  ["legal_entity_contact_details", ["email", "phone", "website"]],
  ["telephone_bid_booking", ["phone_e164", "buyer_notes"]],
  /** The provider's delivery reports for a purged person's mail quote their address. */
  ["email_event", ["payload"]],
  /** The enquiry rule replaces the sender's details and removes what they wrote. */
  ["marketing_enquiry", ["name", "email", "phone", "message", "version"]],
  ["marketing_enquiry_note", ["body"]],
  ["private_sale_enquiry_detail", ["location_town", "location_country", "looking_for"]],
] as const;

/**
 * Erasing an enquiry's sender detaches the files they sent in: the link row is deleted and the
 * upload record is made to expire (upload_object is already granted in full). Nothing else is
 * deleted by that rule.
 */
export const WORKER_ENQUIRY_ERASURE_DELETE_TABLES = ["marketing_enquiry_attachment"] as const;

/**
 * The CRM projector builds a Lead for a signed-in person's Shop original enquiry from these
 * columns and no others. The tables stay denied to the worker as a whole (SHOP_COMMERCE_TABLES);
 * only a column-level SELECT is granted, covering what the reader selects and filters on.
 */
export const WORKER_SHOP_ENQUIRY_READ_COLUMNS = [
  ["shop_artwork", ["id", "title", "slug"]],
  [
    "shop_artwork_interest",
    ["artwork_id", "identity_subject_id", "intent", "reference", "contact_phone"],
  ],
] as const;

/**
 * The CRM projector names a Shop order's Deal from these columns and no others (the order, its
 * first line and the guest behind it). The tables stay denied to the worker as a whole; only a
 * column-level SELECT is granted, covering what the reader selects, joins and filters on.
 */
export const WORKER_SHOP_ORDER_READ_COLUMNS = [
  ["shop_order", ["id", "reference", "guest_customer_id", "delivery_recipient_name"]],
  ["shop_order_line", ["id", "order_id", "artwork_id", "created_at"]],
  ["shop_guest_customer", ["id", "name"]],
] as const;

/**
 * The Zoho fulfilment mirror works out a print group from these columns and no others: the prints
 * listing, the original it was made from (the same table), and how its prints are held. The tables
 * stay denied to the worker as a whole; only a column-level SELECT is granted.
 */
export const WORKER_SHOP_PRINT_GROUP_READ_COLUMNS = [
  [
    "shop_artwork",
    [
      "id",
      "title",
      "medium",
      "dimensions",
      "year_created",
      "source_original_artwork_id",
      "zoho_product_id",
      "run_kind",
      "run_role",
      "main_run_artwork_id",
    ],
  ],
  ["shop_edition", ["artwork_id", "allocation", "proof_number"]],
] as const;

/**
 * The Bid admin report of originals that are live without a Zoho record (Settings › Unlinked
 * originals) lists lax.art's live originals with their artist's name, from these columns and no
 * others: what `DrizzleUnlinkedOriginalsReader` selects, joins and filters on. The tables stay
 * denied to the Bid API as a whole (SHOP_COMMERCE_TABLES); only a column-level SELECT is granted,
 * and nothing that writes.
 */
export const API_UNLINKED_ORIGINALS_READ_COLUMNS = [
  [
    "shop_artwork",
    [
      "id",
      "title",
      "artist_id",
      "zoho_product_id",
      "sales_channel",
      "run_kind",
      "eligible_for_edition_allocation",
      "published_at",
      "archived_at",
    ],
  ],
  ["shop_artist", ["id", "party_id"]],
  ["shop_party", ["id", "display_name"]],
] as const;

type RoleName = "auth_app" | "api_app" | "shop_app" | "worker_app";

export const APPLICATION_ROLE_GRANT_LOCK_KEY = "lax:application_role_grants";

const ROLE_PASSWORD_ENV: Record<RoleName, string> = {
  auth_app: "AUTH_APP_DB_PASSWORD",
  api_app: "API_APP_DB_PASSWORD",
  shop_app: "SHOP_APP_DB_PASSWORD",
  worker_app: "WORKER_APP_DB_PASSWORD",
};

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function tableExists(
  client: pg.Client,
  tableName: string,
  schemaName = "public",
): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = $1 and table_name = $2
    )`,
    [schemaName, tableName],
  );
  return Boolean(res.rows[0]?.exists);
}

async function existingPublicTables(client: pg.Client): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return res.rows.map((row) => row.table_name);
}

async function hasTablePrivilege(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privilege: "SELECT",
  schemaName = "public",
): Promise<boolean> {
  if (!(await tableExists(client, tableName, schemaName))) return false;
  const res = await client.query<{ allowed: boolean }>(
    "select has_table_privilege($1, $2, $3) as allowed",
    [role, `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`, privilege],
  );
  return Boolean(res.rows[0]?.allowed);
}

/** Advisory locks are cluster-wide; any existing database on the URI works. */
export function resolveApplicationRoleGrantLockDatabaseUrl(connectionString: string): string {
  const configured = process.env.APPLICATION_ROLE_GRANT_LOCK_DATABASE?.trim();
  const url = new URL(connectionString);
  if (configured) {
    url.pathname = `/${configured.replace(/^\//, "")}`;
    return url.toString();
  }
  // DO Managed Postgres exposes defaultdb/auction, not a database named "postgres".
  return connectionString;
}

/** Roles are cluster-wide; serialize grant work through the admin database lock. */
export async function withApplicationRoleGrantLock<T>(
  connectionString: string,
  run: () => Promise<T>,
): Promise<T> {
  const lockClient = new Client(
    buildPgConnectionConfig(resolveApplicationRoleGrantLockDatabaseUrl(connectionString)),
  );
  await lockClient.connect();
  try {
    await lockClient.query("select pg_advisory_lock(hashtext($1))", [
      APPLICATION_ROLE_GRANT_LOCK_KEY,
    ]);
    try {
      return await run();
    } finally {
      await lockClient.query("select pg_advisory_unlock(hashtext($1))", [
        APPLICATION_ROLE_GRANT_LOCK_KEY,
      ]);
    }
  } finally {
    await lockClient.end();
  }
}

async function ensureRole(client: pg.Client, role: RoleName): Promise<void> {
  const password = process.env[ROLE_PASSWORD_ENV[role]];
  const createSql = password
    ? `create role ${quoteIdent(role)} login password ${quoteLiteral(password)}`
    : `create role ${quoteIdent(role)} login`;
  await client.query(
    `do $ensure$
     begin
       execute ${quoteLiteral(createSql)};
     exception
       when duplicate_object then null;
     end
     $ensure$`,
  );
  if (password) {
    await client.query(
      `alter role ${quoteIdent(role)} with login password ${quoteLiteral(password)}`,
    );
  } else {
    await client.query(`alter role ${quoteIdent(role)} with login`);
  }
}

export async function ensureApplicationRolesExist(
  connectionString: string,
  client: pg.Client,
  roles: readonly RoleName[],
): Promise<void> {
  await withApplicationRoleGrantLock(connectionString, async () => {
    for (const role of roles) {
      await ensureRole(client, role);
    }
  });
}

async function grantIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privileges:
    | "SELECT"
    | "SELECT, UPDATE"
    | "SELECT, DELETE"
    | "SELECT, UPDATE, DELETE"
    | "INSERT"
    | "INSERT, SELECT"
    | "INSERT, SELECT, DELETE"
    | "SELECT, DELETE"
    | "INSERT, SELECT, UPDATE"
    | "INSERT, SELECT, UPDATE, DELETE"
    | "ALL PRIVILEGES",
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName))) return;
  await client.query(
    `grant ${privileges} on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantColumnUpdateIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  requested: readonly string[],
  schemaName = "public",
  /** For a column a later migration adds: grant what exists now; the next run grants the rest. */
  skipMissingColumns = false,
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName)) || requested.length === 0) return;
  let columns = requested;
  if (skipMissingColumns) {
    const present = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = $1 and table_name = $2",
      [schemaName, tableName],
    );
    const have = new Set(present.rows.map((row) => row.column_name));
    columns = requested.filter((column) => have.has(column));
    if (columns.length === 0) return;
  }
  const columnList = columns.map(quoteIdent).join(", ");
  await client.query(
    `grant update (${columnList}) on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantColumnPrivilegeIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privilege: "select" | "insert" | "update",
  columns: readonly string[],
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName)) || columns.length === 0) return;
  const columnList = columns.map(quoteIdent).join(", ");
  await client.query(
    `grant ${privilege} (${columnList}) on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantColumnSelectIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  columns: readonly string[],
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName)) || columns.length === 0) return;
  const columnList = columns.map(quoteIdent).join(", ");
  await client.query(
    `grant select (${columnList}) on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantExecuteIfFunctionExists(
  client: pg.Client,
  role: RoleName,
  signature: string,
  schemaName = "public",
): Promise<void> {
  const found = await client.query(
    "select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.oid = to_regprocedure($2)",
    [schemaName, `${schemaName}.${signature}`],
  );
  if (found.rowCount === 0) return;
  await client.query(
    `grant execute on function ${quoteIdent(schemaName)}.${signature} to ${quoteIdent(role)}`,
  );
}

async function revokeIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privileges = "ALL PRIVILEGES",
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName))) return;
  await client.query(
    `revoke ${privileges} on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} from ${quoteIdent(role)}`,
  );
}

async function grantSequences(
  client: pg.Client,
  role: RoleName,
  schemaName: string,
): Promise<void> {
  await client.query(
    `grant usage, select on all sequences in schema ${quoteIdent(schemaName)} to ${quoteIdent(role)}`,
  );
}

export async function applyApplicationRoleGrants(connectionString: string): Promise<void> {
  const client = new Client(buildPgConnectionConfig(connectionString));
  await client.connect();
  try {
    await withApplicationRoleGrantLock(connectionString, async () => {
      await client.query("begin");
      try {
        const roles = ["auth_app", "api_app", "shop_app", "worker_app"] as const;
        for (const role of roles) {
          await ensureRole(client, role);
          await client.query(`grant usage on schema public to ${quoteIdent(role)}`);
        }

        // Preserve temporary staged reads only until the matching cutover
        // migration. Privilege state alone cannot distinguish a legitimate
        // pre-cutover grant from stale post-cutover drift.
        const cutover = await readUserReadCutover(client);
        const restoreWorkerUserSelect =
          !cutover.workerUserSelectRevoked &&
          (await hasTablePrivilege(client, "worker_app", "user", "SELECT"));
        const restoreApiUserSelect =
          !cutover.apiUserSelectRevoked &&
          (await hasTablePrivilege(client, "api_app", "user", "SELECT"));

        for (const role of roles) {
          await client.query(
            `revoke all privileges on all tables in schema public from ${quoteIdent(role)}`,
          );
        }

        const tables = await existingPublicTables(client);

        for (const tableName of AUTH_FULL_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT, UPDATE, DELETE");
        }
        for (const tableName of AUTH_INSERT_SELECT_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of AUTH_READ_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "SELECT");
        }
        for (const tableName of AUTH_POLICY_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of AUTH_ADDRESS_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT, UPDATE, DELETE");
        }
        for (const tableName of AUTH_EXPORT_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of AUTH_EXPORT_AUDIT_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of AUTH_LEGAL_ACCEPTANCE_TABLES) {
          await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of tables) {
          if ((API_DENY_TABLES as readonly string[]).includes(tableName)) {
            await revokeIfExists(client, "api_app", tableName);
            continue;
          }
          if ((API_READ_TABLES as readonly string[]).includes(tableName)) {
            continue;
          }
          if ((API_PRODUCT_PROFILE_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "INSERT, SELECT, UPDATE");
            continue;
          }
          if ((API_SSF_RECEIVER_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "INSERT, SELECT, DELETE");
            continue;
          }
          if ((SELLER_TERMS_INSERT_SELECT_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "INSERT, SELECT");
            await grantColumnUpdateIfExists(
              client,
              "api_app",
              tableName,
              SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS,
            );
            continue;
          }
          if ((FINANCE_SETTING_READ_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "SELECT");
            continue;
          }
          if ((API_ACCOUNTING_READ_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "SELECT");
            if ((API_ACCOUNTING_REQUEUE_TABLES as readonly string[]).includes(tableName)) {
              await grantColumnUpdateIfExists(
                client,
                "api_app",
                tableName,
                API_ACCOUNTING_REQUEUE_COLUMNS,
              );
            }
            if ((API_ACCOUNTING_HISTORY_TABLES as readonly string[]).includes(tableName)) {
              await grantIfExists(client, "api_app", tableName, "INSERT");
            }
            continue;
          }
          if ((API_ACCOUNTING_COPY_READ_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "SELECT");
            continue;
          }
          if ((API_ACCOUNTING_SETTING_TABLES as readonly string[]).includes(tableName)) {
            // Read only until a staff route changes the switch; that route's PR grants
            // UPDATE (xero_mode, books_mode, updated_at, updated_by) and nothing wider.
            await grantIfExists(client, "api_app", tableName, "SELECT");
            continue;
          }
          if ((API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES as readonly string[]).includes(tableName)) {
            await grantIfExists(client, "api_app", tableName, "INSERT, SELECT");
            continue;
          }
          if (
            (API_PAYMENT_REFUND_TABLES as readonly string[]).includes(tableName) ||
            (API_PAYMENT_TRANSFER_REFERENCE_TABLES as readonly string[]).includes(tableName) ||
            (API_REFUND_REVERSAL_TABLES as readonly string[]).includes(tableName)
          ) {
            await grantIfExists(client, "api_app", tableName, "INSERT, SELECT");
            continue;
          }
          await grantIfExists(client, "api_app", tableName, "ALL PRIVILEGES");
        }
        for (const tableName of WORKER_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const tableName of SHOP_PRODUCT_PROFILE_TABLES) {
          await grantIfExists(
            client,
            "shop_app",
            tableName,
            tableName === "shop_user_profile"
              ? "INSERT, SELECT, UPDATE"
              : "INSERT, SELECT, UPDATE, DELETE",
          );
        }
        for (const tableName of SHOP_SSF_RECEIVER_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT, DELETE");
        }
        for (const tableName of SHOP_COMMERCE_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT, UPDATE, DELETE");
        }
        for (const tableName of SHOP_COMMERCE_APPEND_ONLY_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT");
        }
        await grantIfExists(client, "shop_app", "domain_events", "INSERT, SELECT");
        for (const tableName of SHOP_EMAIL_OUTBOX_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of SHOP_CRM_READ_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT");
        }
        for (const tableName of SHOP_SUBJECT_EXPORT_READ_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT");
        }
        for (const tableName of SHOP_ARTWORK_REGISTER_READ_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT");
        }
        for (const tableName of SHOP_ARTWORK_REGISTER_OFFER_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT, UPDATE");
        }
        for (const tableName of SHOP_ARTWORK_REGISTER_CONFLICT_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT, UPDATE");
        }
        /** shop's only write is the staff override; it cannot re-point or reopen an item. */
        for (const tableName of SHOP_SOLD_ATTENTION_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "SELECT");
          await revokeIfExists(client, "shop_app", tableName, "UPDATE");
          await grantColumnUpdateIfExists(
            client,
            "shop_app",
            tableName,
            SHOP_SOLD_ATTENTION_UPDATE_COLUMNS,
          );
        }
        for (const tableName of SHOP_ARTWORK_REGISTER_EVENT_TABLES) {
          await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of WORKER_LOCK_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
        }
        /** worker jobs append domain_events (archive cascade, impersonation sweeper). */
        await grantIfExists(client, "worker_app", "domain_events", "INSERT");
        /** AML / SoF projectors insert and resolve MLRO review work items (admin_review_task). */
        await grantIfExists(client, "worker_app", "admin_review_task", "INSERT, SELECT, UPDATE");
        /** SoF documents projector inserts buyer in-app notifications (documents requested / closure). */
        await grantIfExists(client, "worker_app", "notification", "INSERT, SELECT");
        /** The SoF review projector upserts reviews; the retention purge deletes them. */
        await grantIfExists(
          client,
          "worker_app",
          "source_of_funds_document_review",
          "INSERT, SELECT, UPDATE, DELETE",
        );
        for (const tableName of WORKER_KYC_RETENTION_PURGE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, DELETE");
        }
        for (const tableName of WORKER_KYC_RETENTION_DEAL_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const tableName of WORKER_EXPORT_CATEGORY_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const tableName of WORKER_KYC_RETENTION_TOMBSTONE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        /** The impersonation sweeper ends sessions that have expired. */
        await grantIfExists(client, "worker_app", "impersonation_session", "SELECT, UPDATE");
        /** worker send-email reads suppression list and inserts manual suppressions for missing users;
         * the Zoho Campaigns suppression sync upserts unsubscribes and hard bounces, which needs
         * UPDATE on three columns only. */
        await grantIfExists(client, "worker_app", "email_suppression", "INSERT, SELECT");
        await revokeIfExists(client, "worker_app", "email_suppression", "UPDATE");
        await grantColumnUpdateIfExists(
          client,
          "worker_app",
          "email_suppression",
          WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS,
          "public",
          // `source` arrives with migration 0323; roles may be applied before it runs.
          true,
        );
        /** Erasure cancels a purged person's live visits and scrubs the collector's details, and
         * the retention purge clears the kept hand-over record, column by column. */
        await grantColumnUpdateIfExists(
          client,
          "worker_app",
          "collection_booking",
          WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS,
        );
        await grantColumnUpdateIfExists(
          client,
          "worker_app",
          "collection_booking_lot",
          WORKER_COLLECTION_LOT_RELEASE_COLUMNS,
        );
        /** worker enqueues mail from notification-fanout projectors (INSERT) and the send-email
         * job updates rows to sent/failed/sending (SELECT, UPDATE). DELETE remains denied so the
         * outbox stays an immutable audit trail of attempted delivery. */
        await grantIfExists(client, "worker_app", "email_outbox", "INSERT, SELECT, UPDATE");
        /** worker drains marketing_event_outbox (Meta CAPI + sGTM publisher) — INSERT for skipped
         * audit rows, SELECT + UPDATE for poller, DELETE for retention purge of terminal rows only. */
        await grantIfExists(
          client,
          "worker_app",
          "marketing_event_outbox",
          "INSERT, SELECT, UPDATE, DELETE",
        );
        for (const tableName of WORKER_DATA_EXPORT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE, DELETE");
        }
        for (const tableName of WORKER_PRODUCT_PROFILE_TABLES) {
          await grantIfExists(
            client,
            "worker_app",
            tableName,
            tableName === "bid_identity_directory"
              ? "INSERT, SELECT, UPDATE, DELETE"
              : "INSERT, SELECT, UPDATE",
          );
        }
        for (const tableName of WORKER_FULL_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "ALL PRIVILEGES");
        }
        for (const tableName of WORKER_PROVISIONING_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        /** FK target when inserting scan rows. */
        await grantIfExists(client, "worker_app", "qr_code", "SELECT");
        for (const tableName of WORKER_QR_CODE_SCAN_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, DELETE");
        }
        for (const tableName of WORKER_BID_ALERT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_BID_ALERT_PRUNE_DELETE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, DELETE");
        }
        for (const tableName of WORKER_ARTWORK_REGISTER_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_SOLD_ATTENTION_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
          await revokeIfExists(client, "worker_app", tableName, "UPDATE");
          await grantColumnUpdateIfExists(
            client,
            "worker_app",
            tableName,
            WORKER_SOLD_ATTENTION_UPDATE_COLUMNS,
          );
        }
        for (const tableName of WORKER_ARTWORK_REGISTER_APPEND_ONLY_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of SELLER_TERMS_INSERT_SELECT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
          await grantColumnUpdateIfExists(
            client,
            "worker_app",
            tableName,
            SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS,
          );
        }
        for (const tableName of FINANCE_SETTING_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const [tableName, columns] of WORKER_SELLER_TERMS_READ_COLUMNS) {
          // A table-wide SELECT from an earlier build of this grant is taken back first.
          await revokeIfExists(client, "worker_app", tableName, "SELECT");
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }
        for (const tableName of WORKER_ACCOUNTING_DOCUMENT_TABLES) {
          // The worker moves a document along its life cycle; it never rewrites what the document
          // says (payload, totals, product, reference), so UPDATE is column by column.
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
          await grantColumnUpdateIfExists(
            client,
            "worker_app",
            tableName,
            WORKER_ACCOUNTING_DOCUMENT_UPDATE_COLUMNS,
          );
        }
        for (const tableName of WORKER_ACCOUNTING_APPEND_ONLY_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT");
        }
        for (const tableName of WORKER_ACCOUNTING_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const [tableName, columns] of WORKER_SHOP_INVOICE_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }
        for (const [tableName, columns] of SHOP_ACCOUNTING_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "shop_app", tableName, columns);
        }
        for (const tableName of WORKER_ACCOUNTING_COPY_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
          await grantColumnUpdateIfExists(
            client,
            "worker_app",
            tableName,
            WORKER_ACCOUNTING_COPY_UPDATE_COLUMNS,
          );
        }
        for (const tableName of WORKER_ZOHO_CAMPAIGNS_SUPPRESSION_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_ZOHO_CAMPAIGNS_LIFT_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const role of LIFT_ZOHO_CAMPAIGNS_OPT_OUT_ROLES) {
          await grantExecuteIfFunctionExists(client, role, LIFT_ZOHO_CAMPAIGNS_OPT_OUT_FUNCTION);
        }
        for (const role of PAYMENT_REFUND_BACKFILL_ROLES) {
          await grantExecuteIfFunctionExists(client, role, PAYMENT_REFUND_BACKFILL_FUNCTION);
        }
        for (const tableName of WORKER_ZOHO_ARTWORK_SYNC_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_ZOHO_BOOKS_TABLES) {
          // Start from nothing so a table-level grant from an earlier run is removed, then grant by column.
          await revokeIfExists(client, "worker_app", tableName);
          for (const [privilege, columns] of [
            ["select", WORKER_ZOHO_BOOKS_SELECT_COLUMNS],
            ["insert", WORKER_ZOHO_BOOKS_INSERT_COLUMNS],
            ["update", WORKER_ZOHO_BOOKS_UPDATE_COLUMNS],
          ] as const) {
            await grantColumnPrivilegeIfExists(client, "worker_app", tableName, privilege, columns);
          }
        }
        for (const tableName of WORKER_UNSOLD_CHOICE_DEADLINE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of WORKER_UNSOLD_FOLLOW_UP_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of WORKER_DOMAIN_EVENT_DELIVERY_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_PAYMENT_MAINTENANCE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
        }
        for (const tableName of WORKER_INVOICE_RAISE_INSERT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of WORKER_PAYMENT_REFUND_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
        }
        for (const tableName of WORKER_INVOICE_RAISE_FULFILMENT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_FINANCE_INTEGRATION_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_DISPLAY_PAIRING_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE, DELETE");
        }
        for (const tableName of WORKER_FINANCE_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const [tableName, columns] of Object.entries(WORKER_REOFFER_UPDATE_COLUMNS)) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
          await grantColumnUpdateIfExists(client, "worker_app", tableName, columns);
        }
        for (const [tableName, columns] of WORKER_REOFFER_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }
        for (const tableName of WORKER_NOTIFICATION_OUTBOX_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_LIFECYCLE_READ_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
        }
        for (const tableName of WORKER_LIFECYCLE_SNAPSHOT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_FAILED_JOBS_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_ABSENTEE_BID_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
        }
        for (const tableName of WORKER_BID_PLACEMENT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        for (const tableName of WORKER_PAYOUT_SETTLEMENT_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
        }
        await grantColumnUpdateIfExists(
          client,
          "worker_app",
          "legal_entity",
          WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS,
        );
        for (const tableName of WORKER_ANONYMISATION_DELETE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, DELETE");
        }
        for (const [tableName, columns] of WORKER_SHOP_ENQUIRY_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }
        for (const [tableName, columns] of WORKER_SHOP_ORDER_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }
        for (const [tableName, columns] of WORKER_SHOP_PRINT_GROUP_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "worker_app", tableName, columns);
        }

        for (const tableName of WORKER_ENQUIRY_ERASURE_DELETE_TABLES) {
          await grantIfExists(client, "worker_app", tableName, "SELECT, DELETE");
        }

        for (const [tableName, columns] of WORKER_ANONYMISATION_SCRUB_COLUMNS) {
          await grantIfExists(client, "worker_app", tableName, "SELECT");
          await grantColumnUpdateIfExists(client, "worker_app", tableName, columns);
        }

        for (const tableName of API_READ_TABLES) {
          await grantIfExists(client, "api_app", tableName, "SELECT");
        }
        for (const [tableName, columns] of API_UNLINKED_ORIGINALS_READ_COLUMNS) {
          await grantColumnSelectIfExists(client, "api_app", tableName, columns);
        }
        if (restoreWorkerUserSelect) {
          await grantIfExists(client, "worker_app", "user", "SELECT");
        }
        if (restoreApiUserSelect) {
          await grantIfExists(client, "api_app", "user", "SELECT");
        }
        for (const role of ["auth_app", "api_app", "shop_app", "worker_app"] as const) {
          await grantSequences(client, role, "public");
        }

        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    });
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required to apply application role grants");
  }
  applyApplicationRoleGrants(url)
    .then(() => {
      console.log("Application role grants applied.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
