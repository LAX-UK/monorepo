/** Comprehensive demo seed: covers staff roles + client, legal-entity subkind,
 * entity status, entity-member role, KYC state, email state, invitation status,
 * user-address variant, and KYB document. Wipes auth + app tables, then loads
 * all demo data.
 *
 * Run: DATABASE_URL=... pnpm --filter @auction/db db:seed:dev
 * Same password for every seeded account (email/password sign-in).
 * Admin login: admin@lax.bid / Password123!
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { buildPressDemoSaleRow } from "../shared/press-demo.js";

const { Pool } = pg;

/** One password for all seeded accounts — safe for local/staging only. */
const SEED_PASSWORD = "Password123!";

// ─── Seeded user IDs (stable UUIDs — required where APIs/validators expect uuid) ─
const U = {
  admin: "90000000-0000-4000-8000-000000000001",
  accountant: "90000000-0000-4000-8000-000000000002",
  user1: "90000000-0000-4000-8000-000000000003",
  user2: "90000000-0000-4000-8000-000000000004",
  googleTest: "90000000-0000-4000-8000-000000000005",
  appleTest: "90000000-0000-4000-8000-000000000006",
  galleryAdmin: "90000000-0000-4000-8000-000000000007",
  galleryFinance: "90000000-0000-4000-8000-000000000008",
  suspended: "90000000-0000-4000-8000-000000000009",
  unverified: "90000000-0000-4000-8000-000000000010",
  bounced: "90000000-0000-4000-8000-000000000011",
  kycPending: "90000000-0000-4000-8000-000000000012",
  kycRejected: "90000000-0000-4000-8000-000000000013",
  estateOwner: "90000000-0000-4000-8000-000000000014",
  companyOwner: "90000000-0000-4000-8000-000000000015",
  consignor: "90000000-0000-4000-8000-000000000016",
  buyerAgent: "90000000-0000-4000-8000-000000000017",
  viewer: "90000000-0000-4000-8000-000000000018",
  specialist: "90000000-0000-4000-8000-000000000019",
  staffAuctionMgr: "90000000-0000-4000-8000-000000000020",
  staffCatalogueMgr: "90000000-0000-4000-8000-000000000021",
  staffPlatformSpecialist: "90000000-0000-4000-8000-000000000022",
  staffOpsFulfilment: "90000000-0000-4000-8000-000000000023",
  staffContentMarketing: "90000000-0000-4000-8000-000000000024",
  staffSupportConcierge: "90000000-0000-4000-8000-000000000025",
  staffStaffViewer: "90000000-0000-4000-8000-000000000026",
  staffClientAdvisor: "90000000-0000-4000-8000-000000000027",
  staffOperations: "90000000-0000-4000-8000-000000000028",
} as const;

const ADMIN_ID = U.admin;
const ACCOUNTANT_ID = U.accountant;
const USER1_ID = U.user1;
const USER2_ID = U.user2;
const GOOGLE_TEST_ID = U.googleTest;
const APPLE_TEST_ID = U.appleTest;
const GALLERY_ADMIN_ID = U.galleryAdmin;
const GALLERY_FINANCE_ID = U.galleryFinance;
const SUSPENDED_ID = U.suspended;
const UNVERIFIED_ID = U.unverified;
const BOUNCED_ID = U.bounced;
const KYC_PENDING_ID = U.kycPending;
const KYC_REJECTED_ID = U.kycRejected;
const ESTATE_OWNER_ID = U.estateOwner;
const COMPANY_OWNER_ID = U.companyOwner;
const CONSIGNOR_ID = U.consignor;
const BUYER_AGENT_ID = U.buyerAgent;
const VIEWER_ID = U.viewer;
const SPECIALIST_ID = U.specialist;
const STAFF_AUCTION_MGR_ID = U.staffAuctionMgr;
const STAFF_CATALOGUE_MGR_ID = U.staffCatalogueMgr;
const STAFF_PLATFORM_SPECIALIST_ID = U.staffPlatformSpecialist;
const STAFF_OPS_FULFILMENT_ID = U.staffOpsFulfilment;
const STAFF_CONTENT_MARKETING_ID = U.staffContentMarketing;
const STAFF_SUPPORT_CONCIERGE_ID = U.staffSupportConcierge;
const STAFF_VIEWER_PLATFORM_ID = U.staffStaffViewer;
const STAFF_CLIENT_ADVISOR_ID = U.staffClientAdvisor;
const STAFF_OPERATIONS_ID = U.staffOperations;

// ─── Original personal legal-entity IDs ──────────────────────────────────────
const LE = {
  admin: "10000000-0000-4000-8000-000000000001",
  accountant: "10000000-0000-4000-8000-000000000002",
  user1: "10000000-0000-4000-8000-000000000003",
  user2: "10000000-0000-4000-8000-000000000004",
  google: "10000000-0000-4000-8000-000000000005",
  apple: "10000000-0000-4000-8000-000000000006",
  gallery: "10000000-0000-4000-8000-000000000007",
  restrictedDealer: "10000000-0000-4000-8000-000000000008",
} as const;

// ─── Extended personal legal-entity IDs ──────────────────────────────────────
/**
 * Personal (individual) entities for newly-added users, plus Maya Okafor and
 * Samir Patel who were missing personal entities in the original seed (every
 * user must have at least one individual entity per the LAX data model).
 */
const LEX = {
  /** Maya Okafor — her own individual entity (was missing from original seed). */
  mayaPersonal: "10000000-0000-4000-8000-000000000009",
  /** Samir Patel — his own individual entity (was missing from original seed). */
  samirPersonal: "10000000-0000-4000-8000-000000000010",
  suspended: "10000000-0000-4000-8000-000000000011",
  unverified: "10000000-0000-4000-8000-000000000012",
  bounced: "10000000-0000-4000-8000-000000000013",
  kycPending: "10000000-0000-4000-8000-000000000014",
  kycRejected: "10000000-0000-4000-8000-000000000015",
  estateOwner: "10000000-0000-4000-8000-000000000016",
  companyOwner: "10000000-0000-4000-8000-000000000017",
  consignor: "10000000-0000-4000-8000-000000000018",
  buyerAgent: "10000000-0000-4000-8000-000000000019",
  viewer: "10000000-0000-4000-8000-000000000020",
  specialist: "10000000-0000-4000-8000-000000000021",
  staffAuctionMgr: "10000000-0000-4000-8000-000000000022",
  staffCatalogueMgr: "10000000-0000-4000-8000-000000000023",
  staffPlatformSpecialist: "10000000-0000-4000-8000-000000000024",
  staffOpsFulfilment: "10000000-0000-4000-8000-000000000025",
  staffContentMarketing: "10000000-0000-4000-8000-000000000026",
  staffSupportConcierge: "10000000-0000-4000-8000-000000000027",
  staffStaffViewer: "10000000-0000-4000-8000-000000000028",
  staffClientAdvisor: "10000000-0000-4000-8000-000000000029",
  staffOperations: "10000000-0000-4000-8000-000000000030",
} as const;

// ─── Organisation legal-entity IDs — all subkinds × all statuses ─────────────
/**
 * Eight new org entities — one per missing subkind and/or status combination.
 * Together with the original gallery (approved) and restrictedDealer
 * (connect_pending), every legal_entity_status value is now represented.
 */
const LEO = {
  /** estate / lead — brand new, no docs yet. */
  estateLead: "20000000-0000-4000-8000-000000000001",
  /** company / docs_requested — admin has asked for KYB documents. */
  companyDocsRequested: "20000000-0000-4000-8000-000000000002",
  /** charity / docs_received — docs uploaded, awaiting admin re-review. */
  charityDocsReceived: "20000000-0000-4000-8000-000000000003",
  /** institution / under_review — admin is actively reviewing. */
  institutionUnderReview: "20000000-0000-4000-8000-000000000004",
  /** lax_stock / approved — LAX-managed inventory; skips Stripe Connect entirely.
   *  Matches production `PLATFORM_CATALOG_LEGAL_ENTITY_ID` and staff sale create. */
  laxStockApproved: "30000000-0000-4000-9000-000000000001",
  /** other / restricted — flagged but still operational; admin co-sign required. */
  otherRestricted: "20000000-0000-4000-8000-000000000006",
  /** dealer / rejected — hard fail from KYB review. */
  dealerRejected: "20000000-0000-4000-8000-000000000007",
  /** gallery / archived — terminal; hidden from the entity switcher. */
  galleryArchived: "20000000-0000-4000-8000-000000000008",
} as const;

// ─── Upload-object IDs needed for KYB document seeding ───────────────────────
const UPLOAD = {
  charityHouseExtract: "f0000001-0000-4000-8000-000000000001",
  institutionBeneficialOwner: "f0000002-0000-4000-8000-000000000002",
  institutionVatCert: "f0000003-0000-4000-8000-000000000003",
  sofBankStatement: "f0000004-0000-4000-8000-000000000004",
  sofPropertySale: "f0000005-0000-4000-8000-000000000005",
} as const;

/** Stable invitation ids for E2E preview drawer tests. */
const INV = {
  pendingPlatform: "01100001-0000-4000-8000-000000000001",
} as const;

const SOF_DOC = {
  bankStatement: "93000001-0000-4000-8000-000000000001",
  propertySale: "93000002-0000-4000-8000-000000000002",
} as const;

// ─── Original lookup maps ─────────────────────────────────────────────────────
const CAT = {
  paintings: "c1000001-0000-4000-8000-000000000001",
  sculpture: "c1000002-0000-4000-8000-000000000002",
  photography: "c1000003-0000-4000-8000-000000000003",
  digital: "c1000004-0000-4000-8000-000000000004",
  mixed: "c1000005-0000-4000-8000-000000000005",
  drawings: "c1000006-0000-4000-8000-000000000006",
  contemporary: "c1000007-0000-4000-8000-000000000007",
  impressionist: "c1000008-0000-4000-8000-000000000008",
  bronze: "c1000009-0000-4000-8000-000000000009",
  finePrints: "c1000010-0000-4000-8000-000000000010",
  // ── Creator-registry departments (new kinds) ──────────────────────────────
  motorCars: "c1000011-0000-4000-8000-000000000011",
  watches: "c1000012-0000-4000-8000-000000000012",
  books: "c1000013-0000-4000-8000-000000000013",
  coins: "c1000014-0000-4000-8000-000000000014",
  design: "c1000016-0000-4000-8000-000000000016",
  jewellery: "c1000017-0000-4000-8000-000000000017",
  antiques: "c1000018-0000-4000-8000-000000000018",
  memorabilia: "c1000019-0000-4000-8000-000000000019",
} as const;

const S = {
  evening: "e1000001-0000-4000-8000-000000000001",
  online: "e1000002-0000-4000-8000-000000000002",
  // Hybrid salerooms for the multi-room live grid / clerk console demo.
  hybridA: "e1000003-0000-4000-8000-000000000003",
  hybridB: "e1000004-0000-4000-8000-000000000004",
  hybridC: "e1000005-0000-4000-8000-000000000005",
  pressDemo: "e1000006-0000-4000-8000-000000000006",
} as const;

const SUB = {
  draft: "d2000001-0000-4000-8000-000000000001",
  submitted: "d2000002-0000-4000-8000-000000000002",
  underReview: "d2000005-0000-4000-8000-000000000005",
  approved: "d2000006-0000-4000-8000-000000000006",
  rejected: "d2000003-0000-4000-8000-000000000003",
  converted: "d2000004-0000-4000-8000-000000000004",
} as const;

const L = {
  ethereal: "b1000001-0000-4000-8000-000000000001",
  winter: "b1000002-0000-4000-8000-000000000002",
  anatomy: "b1000003-0000-4000-8000-000000000003",
  chromatic: "b1000004-0000-4000-8000-000000000004",
  suspended: "b1000005-0000-4000-8000-000000000005",
  void: "b1000006-0000-4000-8000-000000000006",
  nocturnal: "b1000007-0000-4000-8000-000000000007",
  silent: "b1000008-0000-4000-8000-000000000008",
  golden: "b1000009-0000-4000-8000-000000000009",
  amber: "b1000010-0000-4000-8000-000000000010",
  marginal: "b1000011-0000-4000-8000-000000000011",
  recursive: "b1000012-0000-4000-8000-000000000012",
  cancelledLot: "b1000013-0000-4000-8000-000000000013",
  futureStudy: "b1000014-0000-4000-8000-000000000014",
  paperThin: "b1000015-0000-4000-8000-000000000015",
  riverStudy: "b1000016-0000-4000-8000-000000000016",
  connectBlockedDraft: "b1000017-0000-4000-8000-000000000017",
  // ── Hybrid saleroom lots (Room A: live with lot on block) ──────────────────
  hybridA1: "b1000101-0000-4000-8000-000000000101",
  hybridA2: "b1000102-0000-4000-8000-000000000102",
  hybridA3: "b1000103-0000-4000-8000-000000000103",
  hybridA4: "b1000104-0000-4000-8000-000000000104",
  hybridA5: "b1000105-0000-4000-8000-000000000105",
  // ── Hybrid saleroom lots (Room B: live, between lots) ──────────────────────
  hybridB1: "b1000201-0000-4000-8000-000000000201",
  hybridB2: "b1000202-0000-4000-8000-000000000202",
  hybridB3: "b1000203-0000-4000-8000-000000000203",
  hybridB4: "b1000204-0000-4000-8000-000000000204",
  // ── Hybrid saleroom lots (Room C: paused) ──────────────────────────────────
  hybridC1: "b1000301-0000-4000-8000-000000000301",
  hybridC2: "b1000302-0000-4000-8000-000000000302",
  hybridC3: "b1000303-0000-4000-8000-000000000303",
} as const;

const VENUE = {
  mayfair: "01000001-0000-4000-8000-000000000001",
} as const;

const ARTIST = {
  carolina: "a1000001-0000-4000-8000-000000000001",
  robert: "a1000002-0000-4000-8000-000000000002",
  pendingStudio: "a1000003-0000-4000-8000-000000000003",
  // ── Creator-registry: new kinds ───────────────────────────────────────────
  ferrarispa: "a1000004-0000-4000-8000-000000000004", // marque
  patekPhilippe: "a1000005-0000-4000-8000-000000000005", // brand/manufacturer
  janeAusten: "a1000006-0000-4000-8000-000000000006", // author
  royalMint: "a1000007-0000-4000-8000-000000000007", // mint
  northbankDesign: "a1000009-0000-4000-8000-000000000009", // studio
} as const;

const PAY = {
  amber: "90000001-0000-4000-8000-000000000001",
  marginal: "90000002-0000-4000-8000-000000000002",
  golden: "90000003-0000-4000-8000-000000000003",
  manualReview: "90000004-0000-4000-8000-000000000004",
} as const;

const COMPLIANCE = {
  amlPending: "92000001-0000-4000-8000-000000000001",
  amlTriaged: "92000002-0000-4000-8000-000000000002",
  sofPending: "92000003-0000-4000-8000-000000000003",
} as const;

const STRIPE = {
  disputeOpen: "dp_seed_amber_open",
  disputeClosed: "dp_seed_golden_closed",
} as const;

const PO = {
  paid: "91000001-0000-4000-8000-000000000001",
  scheduledFailure: "91000002-0000-4000-8000-000000000002",
  clawback: "91000003-0000-4000-8000-000000000003",
} as const;

const IMG = {
  a: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80",
  b: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=80",
  c: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
  d: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80",
  e: "https://images.unsplash.com/photo-1501472312651-726afe119ff1?w=1200&q=80",
} as const;

// ─── Legal-entity lookup (personal entity for bid/payment attribution) ────────
const legalEntityIdForUser = (userId: string): string => {
  switch (userId) {
    case ADMIN_ID:
      return LE.admin;
    case ACCOUNTANT_ID:
      return LE.accountant;
    case USER1_ID:
      return LE.user1;
    case USER2_ID:
      return LE.user2;
    case GOOGLE_TEST_ID:
      return LE.google;
    case APPLE_TEST_ID:
      return LE.apple;
    case GALLERY_ADMIN_ID:
      return LEX.mayaPersonal;
    case GALLERY_FINANCE_ID:
      return LEX.samirPersonal;
    case SUSPENDED_ID:
      return LEX.suspended;
    case UNVERIFIED_ID:
      return LEX.unverified;
    case BOUNCED_ID:
      return LEX.bounced;
    case KYC_PENDING_ID:
      return LEX.kycPending;
    case KYC_REJECTED_ID:
      return LEX.kycRejected;
    case ESTATE_OWNER_ID:
      return LEX.estateOwner;
    case COMPANY_OWNER_ID:
      return LEX.companyOwner;
    case CONSIGNOR_ID:
      return LEX.consignor;
    case BUYER_AGENT_ID:
      return LEX.buyerAgent;
    case VIEWER_ID:
      return LEX.viewer;
    case SPECIALIST_ID:
      return LEX.specialist;
    case STAFF_AUCTION_MGR_ID:
      return LEX.staffAuctionMgr;
    case STAFF_CATALOGUE_MGR_ID:
      return LEX.staffCatalogueMgr;
    case STAFF_PLATFORM_SPECIALIST_ID:
      return LEX.staffPlatformSpecialist;
    case STAFF_OPS_FULFILMENT_ID:
      return LEX.staffOpsFulfilment;
    case STAFF_CONTENT_MARKETING_ID:
      return LEX.staffContentMarketing;
    case STAFF_SUPPORT_CONCIERGE_ID:
      return LEX.staffSupportConcierge;
    case STAFF_VIEWER_PLATFORM_ID:
      return LEX.staffStaffViewer;
    case STAFF_CLIENT_ADVISOR_ID:
      return LEX.staffClientAdvisor;
    case STAFF_OPERATIONS_ID:
      return LEX.staffOperations;
    default:
      throw new Error(`Missing seeded legal entity for user ${userId}`);
  }
};

async function clearAll(db: ReturnType<typeof drizzle<typeof schema>>) {
  const {
    adminReviewTask,
    artistAlias,
    artistCategories,
    artistProfile,
    artistWatchlist,
    emailEvent,
    emailOutbox,
    emailSuppression,
    domainEvent,
    jwksKey,
    kycVerification,
    kycWatchlistScreening,
    sourceOfFunds,
    sourceOfFundsDocument,
    sourceOfFundsDocumentReview,
    impersonationSession,
    legalEntityAddress,
    legalEntityDocument,
    legalEntityPayoutMethod,
    payment,
    notification,
    notificationPreference,
    newsletterSignupLog,
    paymentExternalRef,
    payoutLine,
    payout,
    projectorState,
    pushSubscription,
    saleFollow,
    watchlist,
    bid,
    submissionCategories,
    itemSubmission,
    lotCategories,
    lot,
    saleroomEvent,
    saleroomSession,
    saleCategories,
    sale,
    venue,
    legalEntityMember,
    legalEntity,
    category,
    session,
    account,
    verification,
    userInvitation,
    externalAccount,
    uploadObject,
    userAddress,
    webhookEvent,
    xeroConnection,
    xeroWebhookEvent,
    user,
  } = schema;
  await db.delete(saleroomEvent);
  await db.delete(saleroomSession);
  await db.delete(projectorState);
  await db.delete(domainEvent);
  await db.delete(emailEvent);
  await db.delete(emailOutbox);
  await db.delete(emailSuppression);
  await db.delete(newsletterSignupLog);
  await db.delete(webhookEvent);
  await db.delete(xeroWebhookEvent);
  await db.delete(pushSubscription);
  await db.delete(notificationPreference);
  await db.delete(userAddress);
  await db.delete(sourceOfFundsDocumentReview);
  await db.delete(sourceOfFundsDocument);
  await db.delete(sourceOfFunds);
  await db.delete(kycWatchlistScreening);
  await db.delete(kycVerification);
  await db.delete(payoutLine);
  await db.delete(payout);
  await db.delete(legalEntityPayoutMethod);
  await db.delete(paymentExternalRef);
  await db.delete(payment);
  await db.delete(xeroConnection);
  await db.delete(notification);
  await db.delete(artistWatchlist);
  await db.delete(watchlist);
  await db.delete(saleFollow);
  await db.delete(bid);
  await db.delete(submissionCategories);
  await db.delete(itemSubmission);
  await db.delete(adminReviewTask);
  await db.delete(lotCategories);
  await db.delete(lot);
  await db.delete(saleCategories);
  await db.delete(sale);
  await db.delete(venue);
  await db.delete(artistAlias);
  await db.delete(artistCategories);
  await db.delete(artistProfile);
  await db.delete(legalEntityDocument);
  await db.delete(legalEntityAddress);
  await db.delete(impersonationSession);
  await db.delete(legalEntityMember);
  await db.delete(legalEntity);
  await db.delete(uploadObject);
  await db.delete(category);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(userInvitation);
  await db.delete(externalAccount);
  await db.delete(jwksKey);
  await db.delete(user);
}

export async function runLegacyDemoSeed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool(buildPgConnectionConfig(url));
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const day = 86_400_000;
  const hour = 3_600_000;
  const stamp = new Date();

  const {
    adminReviewTask,
    artistAlias,
    artistCategories,
    artistProfile,
    user,
    account,
    category,
    sale,
    saleCategories,
    lot,
    lotCategories,
    saleroomSession,
    saleroomEvent,
    bid,
    watchlist,
    notification,
    payment,
    itemSubmission,
    submissionCategories,
    legalEntity,
    legalEntityAddress,
    legalEntityDocument,
    legalEntityMember,
    legalEntityPayoutMethod,
    kycVerification,
    kycWatchlistScreening,
    sourceOfFunds,
    sourceOfFundsDocument,
    notificationPreference,
    payout,
    payoutLine,
    domainEvent,
    projectorState,
    saleFollow,
    artistWatchlist,
    externalAccount,
    uploadObject,
    userAddress,
    userInvitation,
    venue,
  } = schema;

  await clearAll(db);

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const credentialAccount = (userId: string) => ({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: passwordHash,
    createdAt: stamp,
    updatedAt: stamp,
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  // kycStatus, firstName, lastName, dateOfBirth, kycVerifiedAt are now set
  // consistently with the corresponding kycVerification records below.

  await db.insert(user).values([
    // ── Platform staff ───────────────────────────────────────────────────────
    {
      id: ADMIN_ID,
      name: "Eleanor Pereira",
      firstName: "Eleanor",
      lastName: "Pereira",
      email: "admin@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "super_admin",
      kycStatus: "unverified",
      createdAt: new Date(now - 180 * day),
      updatedAt: stamp,
    },
    {
      id: ACCOUNTANT_ID,
      name: "Erin Ledger",
      firstName: "Erin",
      lastName: "Ledger",
      email: "accountant@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "finance_ops",
      kycStatus: "unverified",
      createdAt: new Date(now - 150 * day),
      updatedAt: stamp,
    },

    // ── Platform staff — capability matrix (one login per staff_role flavour) ─
    {
      id: STAFF_AUCTION_MGR_ID,
      name: "Alex Mercer",
      firstName: "Alex",
      lastName: "Mercer",
      email: "staff-auction-mgr@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "auction_manager",
      kycStatus: "unverified",
      createdAt: new Date(now - 140 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_CATALOGUE_MGR_ID,
      name: "Blair Chen",
      firstName: "Blair",
      lastName: "Chen",
      email: "staff-catalogue@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "catalogue_manager",
      kycStatus: "unverified",
      createdAt: new Date(now - 138 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_PLATFORM_SPECIALIST_ID,
      name: "Cameron Webb",
      firstName: "Cameron",
      lastName: "Webb",
      email: "platform-specialist@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "specialist",
      kycStatus: "unverified",
      createdAt: new Date(now - 136 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_OPS_FULFILMENT_ID,
      name: "Dana Ortiz",
      firstName: "Dana",
      lastName: "Ortiz",
      email: "staff-ops@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "operations_fulfilment",
      kycStatus: "unverified",
      createdAt: new Date(now - 134 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_CONTENT_MARKETING_ID,
      name: "Elliot Rhodes",
      firstName: "Elliot",
      lastName: "Rhodes",
      email: "staff-content@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "content_marketing",
      kycStatus: "unverified",
      createdAt: new Date(now - 132 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_SUPPORT_CONCIERGE_ID,
      name: "Fiona Nguyen",
      firstName: "Fiona",
      lastName: "Nguyen",
      email: "staff-support@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "support_concierge",
      kycStatus: "unverified",
      createdAt: new Date(now - 130 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_VIEWER_PLATFORM_ID,
      name: "Graham Holt",
      firstName: "Graham",
      lastName: "Holt",
      email: "staff-readonly@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "staff_viewer",
      kycStatus: "unverified",
      createdAt: new Date(now - 128 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_CLIENT_ADVISOR_ID,
      name: "Hannah Price",
      firstName: "Hannah",
      lastName: "Price",
      email: "staff-advisor@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "client_advisor",
      kycStatus: "unverified",
      createdAt: new Date(now - 126 * day),
      updatedAt: stamp,
    },
    {
      id: STAFF_OPERATIONS_ID,
      name: "Ian Brooks",
      firstName: "Ian",
      lastName: "Brooks",
      email: "staff-operations@lax.bid",
      emailVerified: true,
      image: null,
      role: "staff",
      staffRole: "operations",
      kycStatus: "unverified",
      createdAt: new Date(now - 124 * day),
      updatedAt: stamp,
    },

    // ── Fully-verified clients ────────────────────────────────────────────────
    {
      id: USER1_ID,
      name: "Robert Thorne",
      firstName: "Robert",
      lastName: "Thorne",
      mobile: "+44 7700 900001",
      email: "user1@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 89 * day),
      dateOfBirth: "1982-04-11",
      createdAt: new Date(now - 120 * day),
      updatedAt: stamp,
    },
    {
      id: USER2_ID,
      name: "Carolina Price",
      firstName: "Carolina",
      lastName: "Price",
      mobile: "+44 7700 900002",
      email: "user2@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 89 * day),
      dateOfBirth: "1990-09-03",
      createdAt: new Date(now - 45 * day),
      updatedAt: stamp,
    },

    // ── OAuth provider fixtures ───────────────────────────────────────────────
    {
      id: GOOGLE_TEST_ID,
      name: "Google Test",
      email: "google-test@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      createdAt: new Date(now - 30 * day),
      updatedAt: stamp,
    },
    {
      id: APPLE_TEST_ID,
      name: "Apple Test",
      email: "apple-test@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      createdAt: new Date(now - 30 * day),
      updatedAt: stamp,
    },

    // ── Gallery members ───────────────────────────────────────────────────────
    {
      id: GALLERY_ADMIN_ID,
      name: "Maya Okafor",
      firstName: "Maya",
      lastName: "Okafor",
      email: "gallery-admin@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      /** KYC session is in requires_input → maps to platform kycStatus pending. */
      kycStatus: "pending",
      createdAt: new Date(now - 75 * day),
      updatedAt: stamp,
    },
    {
      id: GALLERY_FINANCE_ID,
      name: "Samir Patel",
      firstName: "Samir",
      lastName: "Patel",
      mobile: "+44 7700 900008",
      email: "gallery-finance@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      createdAt: new Date(now - 70 * day),
      updatedAt: stamp,
    },

    // ── Edge-case: suspended client ───────────────────────────────────────────
    {
      id: SUSPENDED_ID,
      name: "Isabelle Laurent",
      firstName: "Isabelle",
      lastName: "Laurent",
      email: "suspended@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 20 * day),
      dateOfBirth: "1985-07-22",
      suspendedAt: new Date(now - 3 * day),
      suspendedReason: "Chargeback dispute under investigation.",
      createdAt: new Date(now - 60 * day),
      updatedAt: stamp,
    },

    // ── Edge-case: unverified email ───────────────────────────────────────────
    {
      id: UNVERIFIED_ID,
      name: "Felix Nakamura",
      firstName: "Felix",
      lastName: "Nakamura",
      email: "unverified@lax.bid",
      emailVerified: false,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      createdAt: new Date(now - 1 * day),
      updatedAt: stamp,
    },

    // ── Edge-case: bounced email ──────────────────────────────────────────────
    {
      id: BOUNCED_ID,
      name: "Yara Siddiqui",
      firstName: "Yara",
      lastName: "Siddiqui",
      email: "bounced@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      emailStatus: "bounced",
      emailStatusChangedAt: new Date(now - 5 * day),
      createdAt: new Date(now - 40 * day),
      updatedAt: stamp,
    },

    // ── Edge-case: KYC pending (Stripe Identity in processing) ───────────────
    {
      id: KYC_PENDING_ID,
      name: "Marcus Obi",
      firstName: "Marcus",
      lastName: "Obi",
      email: "kyc-pending@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "pending",
      createdAt: new Date(now - 7 * day),
      updatedAt: stamp,
    },

    // ── Edge-case: KYC rejected ───────────────────────────────────────────────
    {
      id: KYC_REJECTED_ID,
      name: "Priya Mehta",
      firstName: "Priya",
      lastName: "Mehta",
      email: "kyc-rejected@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "rejected",
      createdAt: new Date(now - 14 * day),
      updatedAt: stamp,
    },

    // ── Org owners ────────────────────────────────────────────────────────────
    {
      id: ESTATE_OWNER_ID,
      name: "Victoria Harrington",
      firstName: "Victoria",
      lastName: "Harrington",
      mobile: "+44 7700 900010",
      email: "estate-owner@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 30 * day),
      dateOfBirth: "1968-03-14",
      createdAt: new Date(now - 50 * day),
      updatedAt: stamp,
    },
    {
      id: COMPANY_OWNER_ID,
      name: "James Crowley",
      firstName: "James",
      lastName: "Crowley",
      mobile: "+44 7700 900011",
      email: "company-owner@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 35 * day),
      dateOfBirth: "1975-11-30",
      createdAt: new Date(now - 55 * day),
      updatedAt: stamp,
    },

    // ── Entity-role fixtures ──────────────────────────────────────────────────
    {
      id: CONSIGNOR_ID,
      name: "Lena Fischer",
      firstName: "Lena",
      lastName: "Fischer",
      email: "consignor@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 25 * day),
      dateOfBirth: "1992-06-08",
      createdAt: new Date(now - 40 * day),
      updatedAt: stamp,
    },
    {
      id: BUYER_AGENT_ID,
      name: "Hassan Al-Rashid",
      firstName: "Hassan",
      lastName: "Al-Rashid",
      mobile: "+44 7700 900013",
      email: "buyer-agent@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 22 * day),
      dateOfBirth: "1988-02-19",
      createdAt: new Date(now - 35 * day),
      updatedAt: stamp,
    },
    {
      id: VIEWER_ID,
      name: "Sofia Petrov",
      firstName: "Sofia",
      lastName: "Petrov",
      email: "viewer@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "unverified",
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },
    {
      id: SPECIALIST_ID,
      name: "Dominic Ward",
      firstName: "Dominic",
      lastName: "Ward",
      mobile: "+44 7700 900015",
      email: "specialist@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      staffRole: null,
      kycStatus: "approved",
      kycVerifiedAt: new Date(now - 40 * day),
      dateOfBirth: "1983-09-25",
      createdAt: new Date(now - 60 * day),
      updatedAt: stamp,
    },
  ]);

  // ── Credential accounts ────────────────────────────────────────────────────
  await db
    .insert(account)
    .values([
      credentialAccount(ADMIN_ID),
      credentialAccount(ACCOUNTANT_ID),
      credentialAccount(STAFF_AUCTION_MGR_ID),
      credentialAccount(STAFF_CATALOGUE_MGR_ID),
      credentialAccount(STAFF_PLATFORM_SPECIALIST_ID),
      credentialAccount(STAFF_OPS_FULFILMENT_ID),
      credentialAccount(STAFF_CONTENT_MARKETING_ID),
      credentialAccount(STAFF_SUPPORT_CONCIERGE_ID),
      credentialAccount(STAFF_VIEWER_PLATFORM_ID),
      credentialAccount(STAFF_CLIENT_ADVISOR_ID),
      credentialAccount(STAFF_OPERATIONS_ID),
      credentialAccount(USER1_ID),
      credentialAccount(USER2_ID),
      credentialAccount(GOOGLE_TEST_ID),
      credentialAccount(APPLE_TEST_ID),
      credentialAccount(GALLERY_ADMIN_ID),
      credentialAccount(GALLERY_FINANCE_ID),
      credentialAccount(SUSPENDED_ID),
      credentialAccount(UNVERIFIED_ID),
      credentialAccount(BOUNCED_ID),
      credentialAccount(KYC_PENDING_ID),
      credentialAccount(KYC_REJECTED_ID),
      credentialAccount(ESTATE_OWNER_ID),
      credentialAccount(COMPANY_OWNER_ID),
      credentialAccount(CONSIGNOR_ID),
      credentialAccount(BUYER_AGENT_ID),
      credentialAccount(VIEWER_ID),
      credentialAccount(SPECIALIST_ID),
    ]);

  // ── OAuth external accounts ────────────────────────────────────────────────
  await db.insert(externalAccount).values([
    {
      userId: GOOGLE_TEST_ID,
      provider: "google",
      externalId: "google-test-sub",
      email: "google-test@lax.bid",
      metadata: { seeded: true },
    },
    {
      userId: APPLE_TEST_ID,
      provider: "apple",
      externalId: "apple-test-sub",
      email: "apple-test@lax.bid",
      metadata: { seeded: true },
    },
  ]);

  // ── Legal entities — personal (individual) ─────────────────────────────────
  await db.insert(legalEntity).values([
    // ── Original personal entities ────────────────────────────────────────────
    {
      id: LE.admin,
      displayName: "Eleanor Pereira",
      legalName: "Eleanor Pereira",
      slug: "eleanor-pereira",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: ADMIN_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LE.accountant,
      displayName: "Erin Ledger",
      legalName: "Erin Ledger",
      slug: "erin-ledger",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: ACCOUNTANT_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LE.user1,
      displayName: "Robert Thorne",
      legalName: "Robert Thorne",
      slug: "robert-thorne",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: USER1_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_robert_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      xeroContactId: "xero-contact-robert-seed",
      marginSchemeEligible: true,
      platformFeeBps: 500,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LE.user2,
      displayName: "Carolina Price",
      legalName: "Carolina Price",
      slug: "carolina-price",
      kind: "individual",
      subkind: "artist",
      createdByUserId: USER2_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_carolina_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      xeroContactId: "xero-contact-carolina-seed",
      marginSchemeEligible: true,
      platformFeeBps: 500,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LE.google,
      displayName: "Google Test",
      legalName: "Google Test",
      slug: "google-test",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: GOOGLE_TEST_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LE.apple,
      displayName: "Apple Test",
      legalName: "Apple Test",
      slug: "apple-test",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: APPLE_TEST_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },

    // ── Original organisation entities ────────────────────────────────────────
    {
      id: LE.gallery,
      displayName: "Northbank Gallery",
      legalName: "Northbank Gallery Ltd",
      slug: "northbank-gallery",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: GALLERY_ADMIN_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_northbank_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      xeroContactId: "xero-contact-northbank-seed",
      vatNumber: "GB123456789",
      marginSchemeEligible: true,
      platformFeeBps: 450,
      createdAt: new Date(now - 75 * day),
      updatedAt: stamp,
    },
    {
      id: LE.restrictedDealer,
      displayName: "Cedar & Stone Fine Art",
      legalName: "Cedar & Stone Fine Art LLP",
      slug: "cedar-stone-fine-art",
      kind: "organisation",
      subkind: "dealer",
      createdByUserId: GALLERY_ADMIN_ID,
      status: "connect_pending",
      statusChangedAt: new Date(now - 10 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_cedar_needs_info",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: ["company.verification.document", "external_account"],
      stripeConnectRequirementsErrors: [
        {
          requirement: "company.verification.document",
          code: "verification_document_failed_greyscale",
          reason: "Greyscale documents cannot be read. Please upload a color copy of the document.",
        },
      ],
      vatNumber: "GB987654321",
      marginSchemeEligible: true,
      platformFeeBps: 500,
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },

    // ── Extended personal entities: Maya & Samir (were missing) ───────────────
    {
      id: LEX.mayaPersonal,
      displayName: "Maya Okafor",
      legalName: "Maya Okafor",
      slug: "maya-okafor",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: GALLERY_ADMIN_ID,
      status: "lead",
      createdAt: new Date(now - 75 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.samirPersonal,
      displayName: "Samir Patel",
      legalName: "Samir Patel",
      slug: "samir-patel",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: GALLERY_FINANCE_ID,
      status: "lead",
      createdAt: new Date(now - 70 * day),
      updatedAt: stamp,
    },

    // ── Edge-case personal entities ────────────────────────────────────────────
    {
      id: LEX.suspended,
      displayName: "Isabelle Laurent",
      legalName: "Isabelle Laurent",
      slug: "isabelle-laurent",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: SUSPENDED_ID,
      status: "approved",
      statusChangedAt: new Date(now - 20 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_isabelle_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 60 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.unverified,
      displayName: "Felix Nakamura",
      legalName: "Felix Nakamura",
      slug: "felix-nakamura",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: UNVERIFIED_ID,
      /** Email not yet verified → cannot auto-progress past lead. */
      status: "lead",
      createdAt: new Date(now - 1 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.bounced,
      displayName: "Yara Siddiqui",
      legalName: "Yara Siddiqui",
      slug: "yara-siddiqui",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: BOUNCED_ID,
      status: "lead",
      createdAt: new Date(now - 40 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.kycPending,
      displayName: "Marcus Obi",
      legalName: "Marcus Obi",
      slug: "marcus-obi",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: KYC_PENDING_ID,
      /** KYC in flight → Connect not started yet. */
      status: "lead",
      createdAt: new Date(now - 7 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.kycRejected,
      displayName: "Priya Mehta",
      legalName: "Priya Mehta",
      slug: "priya-mehta",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: KYC_REJECTED_ID,
      /** KYC hard-rejected → entity stays at lead (no admin doc review for individuals). */
      status: "lead",
      createdAt: new Date(now - 14 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.estateOwner,
      displayName: "Victoria Harrington",
      legalName: "Victoria Harrington",
      slug: "victoria-harrington",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: ESTATE_OWNER_ID,
      status: "approved",
      statusChangedAt: new Date(now - 28 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_victoria_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 50 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.companyOwner,
      displayName: "James Crowley",
      legalName: "James Crowley",
      slug: "james-crowley",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: COMPANY_OWNER_ID,
      status: "approved",
      statusChangedAt: new Date(now - 33 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_james_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 55 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.consignor,
      displayName: "Lena Fischer",
      legalName: "Lena Fischer",
      slug: "lena-fischer",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: CONSIGNOR_ID,
      status: "approved",
      statusChangedAt: new Date(now - 23 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_lena_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 40 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.buyerAgent,
      displayName: "Hassan Al-Rashid",
      legalName: "Hassan Al-Rashid",
      slug: "hassan-al-rashid",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: BUYER_AGENT_ID,
      status: "approved",
      statusChangedAt: new Date(now - 20 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_hassan_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 35 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.viewer,
      displayName: "Sofia Petrov",
      legalName: "Sofia Petrov",
      slug: "sofia-petrov",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: VIEWER_ID,
      status: "lead",
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },
    {
      id: LEX.specialist,
      displayName: "Dominic Ward",
      legalName: "Dominic Ward",
      slug: "dominic-ward",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: SPECIALIST_ID,
      status: "approved",
      statusChangedAt: new Date(now - 38 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_dominic_ready",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 60 * day),
      updatedAt: stamp,
    },

    // ── Personal entities — platform staff (capability matrix logins) ─────────
    {
      id: LEX.staffAuctionMgr,
      displayName: "Alex Mercer",
      legalName: "Alex Mercer",
      slug: "alex-mercer-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_AUCTION_MGR_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffCatalogueMgr,
      displayName: "Blair Chen",
      legalName: "Blair Chen",
      slug: "blair-chen-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_CATALOGUE_MGR_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffPlatformSpecialist,
      displayName: "Cameron Webb",
      legalName: "Cameron Webb",
      slug: "cameron-webb-platform-specialist",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_PLATFORM_SPECIALIST_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffOpsFulfilment,
      displayName: "Dana Ortiz",
      legalName: "Dana Ortiz",
      slug: "dana-ortiz-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_OPS_FULFILMENT_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffContentMarketing,
      displayName: "Elliot Rhodes",
      legalName: "Elliot Rhodes",
      slug: "elliot-rhodes-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_CONTENT_MARKETING_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffSupportConcierge,
      displayName: "Fiona Nguyen",
      legalName: "Fiona Nguyen",
      slug: "fiona-nguyen-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_SUPPORT_CONCIERGE_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffStaffViewer,
      displayName: "Graham Holt",
      legalName: "Graham Holt",
      slug: "graham-holt-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_VIEWER_PLATFORM_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffClientAdvisor,
      displayName: "Hannah Price",
      legalName: "Hannah Price",
      slug: "hannah-price-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_CLIENT_ADVISOR_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: LEX.staffOperations,
      displayName: "Ian Brooks",
      legalName: "Ian Brooks",
      slug: "ian-brooks-platform-staff",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: STAFF_OPERATIONS_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);

  // ── Legal entities — organisations (all subkinds + all remaining statuses) ──
  await db.insert(legalEntity).values([
    // estate / lead ────────────────────────────────────────────────────────────
    {
      id: LEO.estateLead,
      displayName: "Harrington Estate",
      legalName: "The Harrington Estate Trust",
      slug: "harrington-estate",
      kind: "organisation",
      subkind: "estate",
      createdByUserId: ESTATE_OWNER_ID,
      status: "lead",
      createdAt: new Date(now - 10 * day),
      updatedAt: stamp,
    },

    // company / docs_requested ─────────────────────────────────────────────────
    {
      id: LEO.companyDocsRequested,
      displayName: "Crowley Fine Art Ltd",
      legalName: "Crowley Fine Art Limited",
      slug: "crowley-fine-art",
      kind: "organisation",
      subkind: "company",
      createdByUserId: COMPANY_OWNER_ID,
      status: "docs_requested",
      statusChangedAt: new Date(now - 12 * day),
      statusChangedByUserId: ADMIN_ID,
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },

    // charity / docs_received ──────────────────────────────────────────────────
    {
      id: LEO.charityDocsReceived,
      displayName: "Crowley Arts Foundation",
      legalName: "Crowley Arts Foundation (Registered Charity 1234567)",
      slug: "crowley-arts-foundation",
      kind: "organisation",
      subkind: "charity",
      createdByUserId: COMPANY_OWNER_ID,
      status: "docs_received",
      statusChangedAt: new Date(now - 8 * day),
      statusChangedByUserId: ADMIN_ID,
      createdAt: new Date(now - 25 * day),
      updatedAt: stamp,
    },

    // institution / under_review ───────────────────────────────────────────────
    {
      id: LEO.institutionUnderReview,
      displayName: "Meridian Institute of Art",
      legalName: "Meridian Institute of Art",
      slug: "meridian-institute",
      kind: "organisation",
      subkind: "institution",
      createdByUserId: COMPANY_OWNER_ID,
      status: "under_review",
      statusChangedAt: new Date(now - 4 * day),
      statusChangedByUserId: ADMIN_ID,
      createdAt: new Date(now - 30 * day),
      updatedAt: stamp,
    },

    // lax_stock / approved — LAX-managed inventory ─────────────────────────────
    {
      id: LEO.laxStockApproved,
      displayName: "LAX House Stock",
      legalName: "LAX London Auction House Stock Account",
      slug: "lax-house-stock",
      kind: "organisation",
      subkind: "lax_stock",
      /** Only platform admins may create lax_stock entities. */
      createdByUserId: ADMIN_ID,
      status: "approved",
      statusChangedAt: stamp,
      statusChangedByUserId: ADMIN_ID,
      /** Skips Stripe Connect entirely — settles internally. */
      isLaxManaged: true,
      xeroContactId: "xero-contact-lax-stock-seed",
      createdAt: new Date(now - 365 * day),
      updatedAt: stamp,
    },

    // other / restricted ───────────────────────────────────────────────────────
    {
      id: LEO.otherRestricted,
      displayName: "Harrington Advisors",
      legalName: "Harrington Advisors Partnership",
      slug: "harrington-advisors",
      kind: "organisation",
      subkind: "other",
      createdByUserId: ESTATE_OWNER_ID,
      status: "restricted",
      statusChangedAt: new Date(now - 6 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_harrington_advisors",
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      createdAt: new Date(now - 45 * day),
      updatedAt: stamp,
    },

    // dealer / rejected ────────────────────────────────────────────────────────
    {
      id: LEO.dealerRejected,
      displayName: "Crowley Secondary Market",
      legalName: "Crowley Secondary Market Ltd",
      slug: "crowley-secondary-market",
      kind: "organisation",
      subkind: "dealer",
      createdByUserId: COMPANY_OWNER_ID,
      status: "rejected",
      statusChangedAt: new Date(now - 5 * day),
      statusChangedByUserId: ADMIN_ID,
      stripeConnectAccountId: "acct_seed_crowley_rejected",
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [
        "company.verification.document",
        "beneficial_owner.verification.document",
      ],
      createdAt: new Date(now - 40 * day),
      updatedAt: stamp,
    },

    // gallery / archived ───────────────────────────────────────────────────────
    {
      id: LEO.galleryArchived,
      displayName: "Northbank Pop-Up",
      legalName: "Northbank Pop-Up Ltd",
      slug: "northbank-popup",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: GALLERY_ADMIN_ID,
      status: "archived",
      statusChangedAt: new Date(now - 90 * day),
      statusChangedByUserId: ADMIN_ID,
      createdAt: new Date(now - 200 * day),
      updatedAt: stamp,
    },
  ]);

  // ── Legal entity members ────────────────────────────────────────────────────
  await db.insert(legalEntityMember).values([
    // ── Personal entity owners (original) ─────────────────────────────────────
    {
      legalEntityId: LE.admin,
      userId: ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LE.accountant,
      userId: ACCOUNTANT_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffAuctionMgr,
      userId: STAFF_AUCTION_MGR_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffCatalogueMgr,
      userId: STAFF_CATALOGUE_MGR_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffPlatformSpecialist,
      userId: STAFF_PLATFORM_SPECIALIST_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffOpsFulfilment,
      userId: STAFF_OPS_FULFILMENT_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffContentMarketing,
      userId: STAFF_CONTENT_MARKETING_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffSupportConcierge,
      userId: STAFF_SUPPORT_CONCIERGE_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffStaffViewer,
      userId: STAFF_VIEWER_PLATFORM_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffClientAdvisor,
      userId: STAFF_CLIENT_ADVISOR_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LEX.staffOperations,
      userId: STAFF_OPERATIONS_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LE.user1,
      userId: USER1_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LE.user2,
      userId: USER2_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LE.google,
      userId: GOOGLE_TEST_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },
    {
      legalEntityId: LE.apple,
      userId: APPLE_TEST_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: stamp,
    },

    // ── Northbank Gallery members (original roles + new roles) ────────────────
    {
      legalEntityId: LE.gallery,
      userId: GALLERY_ADMIN_ID,
      role: "admin",
      isPrimaryAdmin: true,
      invitedByUserId: ADMIN_ID,
      invitedAt: new Date(now - 74 * day),
      acceptedAt: new Date(now - 73 * day),
    },
    {
      legalEntityId: LE.gallery,
      userId: GALLERY_FINANCE_ID,
      role: "finance",
      invitedByUserId: GALLERY_ADMIN_ID,
      invitedAt: new Date(now - 70 * day),
      acceptedAt: new Date(now - 69 * day),
    },
    /** consignor — can submit lots, view own financials only. */
    {
      legalEntityId: LE.gallery,
      userId: CONSIGNOR_ID,
      role: "consignor",
      invitedByUserId: GALLERY_ADMIN_ID,
      invitedAt: new Date(now - 35 * day),
      acceptedAt: new Date(now - 34 * day),
    },
    /** viewer — read-only summary access. */
    {
      legalEntityId: LE.gallery,
      userId: VIEWER_ID,
      role: "viewer",
      invitedByUserId: GALLERY_ADMIN_ID,
      invitedAt: new Date(now - 18 * day),
      acceptedAt: new Date(now - 17 * day),
    },
    /** specialist — LAX staff member invited by the gallery (opt-in). */
    {
      legalEntityId: LE.gallery,
      userId: SPECIALIST_ID,
      role: "specialist",
      invitedByUserId: GALLERY_ADMIN_ID,
      invitedAt: new Date(now - 15 * day),
      acceptedAt: new Date(now - 14 * day),
    },
    /** soft-deleted member: USER2 briefly had a viewer seat, then was removed. */
    {
      legalEntityId: LE.gallery,
      userId: USER2_ID,
      role: "viewer",
      invitedByUserId: GALLERY_ADMIN_ID,
      invitedAt: new Date(now - 50 * day),
      acceptedAt: new Date(now - 49 * day),
      removedAt: new Date(now - 40 * day),
    },

    // ── Cedar & Stone (restrictedDealer) ──────────────────────────────────────
    {
      legalEntityId: LE.restrictedDealer,
      userId: GALLERY_ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      invitedByUserId: ADMIN_ID,
      invitedAt: new Date(now - 20 * day),
      acceptedAt: new Date(now - 19 * day),
    },

    // ── Extended personal entity owners ──────────────────────────────────────
    {
      legalEntityId: LEX.mayaPersonal,
      userId: GALLERY_ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 75 * day),
    },
    {
      legalEntityId: LEX.samirPersonal,
      userId: GALLERY_FINANCE_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 70 * day),
    },
    {
      legalEntityId: LEX.suspended,
      userId: SUSPENDED_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 60 * day),
    },
    {
      legalEntityId: LEX.unverified,
      userId: UNVERIFIED_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 1 * day),
    },
    {
      legalEntityId: LEX.bounced,
      userId: BOUNCED_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 40 * day),
    },
    {
      legalEntityId: LEX.kycPending,
      userId: KYC_PENDING_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 7 * day),
    },
    {
      legalEntityId: LEX.kycRejected,
      userId: KYC_REJECTED_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 14 * day),
    },
    {
      legalEntityId: LEX.estateOwner,
      userId: ESTATE_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 50 * day),
    },
    {
      legalEntityId: LEX.companyOwner,
      userId: COMPANY_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 55 * day),
    },
    {
      legalEntityId: LEX.consignor,
      userId: CONSIGNOR_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 40 * day),
    },
    {
      legalEntityId: LEX.buyerAgent,
      userId: BUYER_AGENT_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 35 * day),
    },
    {
      legalEntityId: LEX.viewer,
      userId: VIEWER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 20 * day),
    },
    {
      legalEntityId: LEX.specialist,
      userId: SPECIALIST_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 60 * day),
    },

    // ── New org entity owners ─────────────────────────────────────────────────
    {
      legalEntityId: LEO.estateLead,
      userId: ESTATE_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 10 * day),
    },
    /** staff — can submit on behalf of entity, limited lot editing. */
    {
      legalEntityId: LEO.estateLead,
      userId: CONSIGNOR_ID,
      role: "staff",
      invitedByUserId: ESTATE_OWNER_ID,
      invitedAt: new Date(now - 9 * day),
      acceptedAt: new Date(now - 8 * day),
    },

    {
      legalEntityId: LEO.companyDocsRequested,
      userId: COMPANY_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 20 * day),
    },
    {
      legalEntityId: LEO.charityDocsReceived,
      userId: COMPANY_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 25 * day),
    },
    {
      legalEntityId: LEO.institutionUnderReview,
      userId: COMPANY_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 30 * day),
    },
    /** LAX-managed stock — admin is the sole member. */
    {
      legalEntityId: LEO.laxStockApproved,
      userId: ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 365 * day),
    },

    {
      legalEntityId: LEO.otherRestricted,
      userId: ESTATE_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 45 * day),
    },
    /** buyer_agent — can place bids on behalf of the entity, no seller capabilities. */
    {
      legalEntityId: LEO.otherRestricted,
      userId: BUYER_AGENT_ID,
      role: "buyer_agent",
      invitedByUserId: ESTATE_OWNER_ID,
      invitedAt: new Date(now - 30 * day),
      acceptedAt: new Date(now - 29 * day),
    },

    {
      legalEntityId: LEO.dealerRejected,
      userId: COMPANY_OWNER_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 40 * day),
    },
    {
      legalEntityId: LEO.galleryArchived,
      userId: GALLERY_ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      acceptedAt: new Date(now - 200 * day),
    },
  ]);

  // ── Legal entity addresses ─────────────────────────────────────────────────
  await db.insert(legalEntityAddress).values([
    // Originals
    {
      legalEntityId: LE.user1,
      addressType: "billing",
      line1: "42 Redcliffe Square",
      line2: null,
      city: "London",
      state: null,
      postalCode: "SW10 9JY",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LE.user2,
      addressType: "billing",
      line1: "18 Princelet Street",
      line2: null,
      city: "London",
      state: null,
      postalCode: "E1 6QH",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LE.gallery,
      addressType: "registered",
      line1: "Northbank Gallery",
      line2: "14 Wapping High Street",
      city: "London",
      state: null,
      postalCode: "E1W 1NG",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LE.restrictedDealer,
      addressType: "registered",
      line1: "Cedar & Stone Fine Art",
      line2: "2 Market Place",
      city: "Bath",
      state: null,
      postalCode: "BA1 1HX",
      country: "GB",
      isDefault: true,
    },

    // New org addresses
    {
      legalEntityId: LEO.estateLead,
      addressType: "registered",
      line1: "Harrington Estate",
      line2: "The Manor, High Lane",
      city: "Cheshire",
      state: null,
      postalCode: "SK6 8DR",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.companyDocsRequested,
      addressType: "registered",
      line1: "Crowley Fine Art Ltd",
      line2: "77 St James's Street",
      city: "London",
      state: null,
      postalCode: "SW1A 1PH",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.charityDocsReceived,
      addressType: "registered",
      line1: "Crowley Arts Foundation",
      line2: "9 Portman Square",
      city: "London",
      state: null,
      postalCode: "W1H 6AZ",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.institutionUnderReview,
      addressType: "registered",
      line1: "Meridian Institute of Art",
      line2: "Meridian Square, South Bank",
      city: "London",
      state: null,
      postalCode: "SE1 7PB",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.laxStockApproved,
      addressType: "registered",
      line1: "LAX London Auction House",
      line2: "12 King Street, St James's",
      city: "London",
      state: null,
      postalCode: "SW1Y 6QU",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.otherRestricted,
      addressType: "registered",
      line1: "Harrington Advisors",
      line2: "8 Curzon Street",
      city: "London",
      state: null,
      postalCode: "W1J 5HP",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.dealerRejected,
      addressType: "registered",
      line1: "Crowley Secondary Market",
      line2: "120 New Bond Street",
      city: "London",
      state: null,
      postalCode: "W1S 1DX",
      country: "GB",
      isDefault: true,
    },
    {
      legalEntityId: LEO.galleryArchived,
      addressType: "registered",
      line1: "Northbank Pop-Up",
      line2: "Unit 4, Bermondsey Square",
      city: "London",
      state: null,
      postalCode: "SE1 3UN",
      country: "GB",
      isDefault: true,
    },
  ]);

  // ── Legal entity payout methods ────────────────────────────────────────────
  await db.insert(legalEntityPayoutMethod).values([
    {
      legalEntityId: LE.user1,
      stripeExternalAccountId: "ba_seed_robert_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 80 * day),
    },
    {
      legalEntityId: LE.user2,
      stripeExternalAccountId: "ba_seed_carolina_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 80 * day),
    },
    {
      legalEntityId: LE.gallery,
      stripeExternalAccountId: "ba_seed_northbank_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 70 * day),
    },
    {
      legalEntityId: LEX.estateOwner,
      stripeExternalAccountId: "ba_seed_victoria_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 27 * day),
    },
    {
      legalEntityId: LEX.companyOwner,
      stripeExternalAccountId: "ba_seed_james_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 32 * day),
    },
    {
      legalEntityId: LEX.suspended,
      stripeExternalAccountId: "ba_seed_isabelle_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 55 * day),
    },
    {
      legalEntityId: LEX.consignor,
      stripeExternalAccountId: "ba_seed_lena_gbp",
      isDefault: true,
      status: "active",
      createdAt: new Date(now - 22 * day),
    },
    /** Retired payout method — demonstrates the retired status. */
    {
      legalEntityId: LE.user1,
      stripeExternalAccountId: "ba_seed_robert_old_gbp",
      isDefault: false,
      status: "retired",
      createdAt: new Date(now - 200 * day),
      retiredAt: new Date(now - 80 * day),
    },
  ]);

  // ── KYC verifications ──────────────────────────────────────────────────────
  await db.insert(kycVerification).values([
    // Robert — verified
    {
      userId: USER1_ID,
      providerSessionId: "vs_seed_robert_verified",
      status: "verified",
      verifiedFirstName: "Robert",
      verifiedLastName: "Thorne",
      verifiedDateOfBirth: "1982-04-11",
      verifiedIdNumberLast4: "4242",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2030-04-11",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 90 * day),
      decisionAt: new Date(now - 89 * day),
    },
    // Carolina — verified
    {
      userId: USER2_ID,
      providerSessionId: "vs_seed_carolina_verified",
      status: "verified",
      verifiedFirstName: "Carolina",
      verifiedLastName: "Price",
      verifiedDateOfBirth: "1990-09-03",
      verifiedIdNumberLast4: "7788",
      verifiedIdCountry: "GB",
      verifiedIdType: "driving_license",
      verifiedIdExpiry: "2029-09-03",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 90 * day),
      decisionAt: new Date(now - 89 * day),
    },
    // Maya — requires_input (pending on user)
    {
      userId: GALLERY_ADMIN_ID,
      providerSessionId: "vs_seed_maya_requires_input",
      status: "requires_input",
      decisionPayload: { seeded: true, missing: ["document.front"] },
      createdAt: new Date(now - 8 * day),
      decisionAt: null,
    },
    // Isabelle (suspended) — verified before account suspension
    {
      userId: SUSPENDED_ID,
      providerSessionId: "vs_seed_isabelle_verified",
      status: "verified",
      verifiedFirstName: "Isabelle",
      verifiedLastName: "Laurent",
      verifiedDateOfBirth: "1985-07-22",
      verifiedIdNumberLast4: "3311",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2031-07-22",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 25 * day),
      decisionAt: new Date(now - 20 * day),
    },
    // Marcus — processing (KYC pending)
    {
      userId: KYC_PENDING_ID,
      providerSessionId: "vs_seed_marcus_processing",
      status: "processing",
      decisionPayload: { seeded: true, phase: "document_check" },
      createdAt: new Date(now - 2 * day),
      decisionAt: null,
    },
    // Priya — canceled (KYC rejected)
    {
      userId: KYC_REJECTED_ID,
      providerSessionId: "vs_seed_priya_canceled",
      status: "canceled",
      decisionPayload: {
        seeded: true,
        reason: "id_document_expired",
        outcome: "requires_input",
      },
      createdAt: new Date(now - 10 * day),
      decisionAt: new Date(now - 9 * day),
    },
    // Victoria — verified
    {
      userId: ESTATE_OWNER_ID,
      providerSessionId: "vs_seed_victoria_verified",
      status: "verified",
      verifiedFirstName: "Victoria",
      verifiedLastName: "Harrington",
      verifiedDateOfBirth: "1968-03-14",
      verifiedIdNumberLast4: "9901",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2028-03-14",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 35 * day),
      decisionAt: new Date(now - 30 * day),
    },
    // James — verified
    {
      userId: COMPANY_OWNER_ID,
      providerSessionId: "vs_seed_james_verified",
      status: "verified",
      verifiedFirstName: "James",
      verifiedLastName: "Crowley",
      verifiedDateOfBirth: "1975-11-30",
      verifiedIdNumberLast4: "5566",
      verifiedIdCountry: "GB",
      verifiedIdType: "driving_license",
      verifiedIdExpiry: "2027-11-30",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 40 * day),
      decisionAt: new Date(now - 35 * day),
    },
    // Lena (consignor) — verified
    {
      userId: CONSIGNOR_ID,
      providerSessionId: "vs_seed_lena_verified",
      status: "verified",
      verifiedFirstName: "Lena",
      verifiedLastName: "Fischer",
      verifiedDateOfBirth: "1992-06-08",
      verifiedIdNumberLast4: "2244",
      verifiedIdCountry: "DE",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2032-06-08",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 30 * day),
      decisionAt: new Date(now - 25 * day),
    },
    // Hassan (buyer_agent) — verified
    {
      userId: BUYER_AGENT_ID,
      providerSessionId: "vs_seed_hassan_verified",
      status: "verified",
      verifiedFirstName: "Hassan",
      verifiedLastName: "Al-Rashid",
      verifiedDateOfBirth: "1988-02-19",
      verifiedIdNumberLast4: "8877",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2029-02-19",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 28 * day),
      decisionAt: new Date(now - 22 * day),
    },
    // Dominic (specialist) — verified
    {
      userId: SPECIALIST_ID,
      providerSessionId: "vs_seed_dominic_verified",
      status: "verified",
      verifiedFirstName: "Dominic",
      verifiedLastName: "Ward",
      verifiedDateOfBirth: "1983-09-25",
      verifiedIdNumberLast4: "6655",
      verifiedIdCountry: "GB",
      verifiedIdType: "passport",
      verifiedIdExpiry: "2030-09-25",
      decisionPayload: { seeded: true, outcome: "verified" },
      createdAt: new Date(now - 45 * day),
      decisionAt: new Date(now - 40 * day),
    },
  ]);

  // ── User addresses (personal shipping/billing — separate from entity addresses) ─
  await db.insert(userAddress).values([
    {
      userId: USER1_ID,
      label: "Home",
      line1: "42 Redcliffe Square",
      city: "London",
      postalCode: "SW10 9JY",
      country: "GB",
      addressType: "both",
      isDefault: true,
    },
    {
      userId: USER2_ID,
      label: "Studio",
      line1: "18 Princelet Street",
      city: "London",
      postalCode: "E1 6QH",
      country: "GB",
      addressType: "both",
      isDefault: true,
    },
    {
      userId: USER2_ID,
      label: "Parents",
      line1: "5 Clifton Villas",
      city: "Bristol",
      postalCode: "BS8 4PH",
      country: "GB",
      addressType: "shipping",
      isDefault: false,
    },
    {
      userId: ESTATE_OWNER_ID,
      label: "Estate Office",
      line1: "The Manor, High Lane",
      city: "Cheshire",
      postalCode: "SK6 8DR",
      country: "GB",
      addressType: "both",
      isDefault: true,
    },
    {
      userId: COMPANY_OWNER_ID,
      label: "London Office",
      line1: "77 St James's Street",
      city: "London",
      postalCode: "SW1A 1PH",
      country: "GB",
      addressType: "billing",
      isDefault: true,
    },
    {
      userId: SUSPENDED_ID,
      label: "Home",
      line1: "3 Rue du Faubourg Saint-Honoré",
      city: "Paris",
      state: "Île-de-France",
      postalCode: "75008",
      country: "FR",
      addressType: "both",
      isDefault: true,
    },
  ]);

  // ── Upload objects for KYB documents ──────────────────────────────────────
  await db.insert(uploadObject).values([
    {
      id: UPLOAD.charityHouseExtract,
      ownerUserId: COMPANY_OWNER_ID,
      kind: "legal_entity_document",
      key: "seed/kyb/charity-house-extract.pdf",
      declaredContentType: "application/pdf",
      declaredByteSize: 204_800,
      actualContentType: "application/pdf",
      actualByteSize: 204_800,
      status: "confirmed",
      createdAt: new Date(now - 9 * day),
      uploadedAt: new Date(now - 9 * day),
      validatedAt: new Date(now - 9 * day),
      expiresAt: new Date(now + 365 * day),
    },
    {
      id: UPLOAD.institutionBeneficialOwner,
      ownerUserId: COMPANY_OWNER_ID,
      kind: "legal_entity_document",
      key: "seed/kyb/institution-beneficial-owner.pdf",
      declaredContentType: "application/pdf",
      declaredByteSize: 512_000,
      actualContentType: "application/pdf",
      actualByteSize: 512_000,
      status: "confirmed",
      createdAt: new Date(now - 5 * day),
      uploadedAt: new Date(now - 5 * day),
      validatedAt: new Date(now - 5 * day),
      expiresAt: new Date(now + 365 * day),
    },
    {
      id: UPLOAD.institutionVatCert,
      ownerUserId: COMPANY_OWNER_ID,
      kind: "legal_entity_document",
      key: "seed/kyb/institution-vat-cert.pdf",
      declaredContentType: "application/pdf",
      declaredByteSize: 81_920,
      actualContentType: "application/pdf",
      actualByteSize: 81_920,
      status: "confirmed",
      createdAt: new Date(now - 5 * day),
      uploadedAt: new Date(now - 5 * day),
      validatedAt: new Date(now - 5 * day),
      expiresAt: new Date(now + 365 * day),
    },
  ]);

  // ── Legal entity KYB documents ─────────────────────────────────────────────
  await db.insert(legalEntityDocument).values([
    /** Charity — docs_received: companies_house_extract pending admin review. */
    {
      legalEntityId: LEO.charityDocsReceived,
      uploadObjectId: UPLOAD.charityHouseExtract,
      kind: "companies_house_extract",
      reviewStatus: "pending",
      uploadedByUserId: COMPANY_OWNER_ID,
      uploadedAt: new Date(now - 9 * day),
    },
    /** Institution — under_review: beneficial owner doc approved, VAT cert pending. */
    {
      legalEntityId: LEO.institutionUnderReview,
      uploadObjectId: UPLOAD.institutionBeneficialOwner,
      kind: "beneficial_owner_id",
      reviewStatus: "approved",
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 3 * day),
      reviewNotes: "Passport scan clear; beneficial owner identity confirmed.",
      uploadedByUserId: COMPANY_OWNER_ID,
      uploadedAt: new Date(now - 5 * day),
    },
    {
      legalEntityId: LEO.institutionUnderReview,
      uploadObjectId: UPLOAD.institutionVatCert,
      kind: "vat_certificate",
      reviewStatus: "pending",
      uploadedByUserId: COMPANY_OWNER_ID,
      uploadedAt: new Date(now - 5 * day),
    },
  ]);

  // ── Notification preferences ───────────────────────────────────────────────
  await db.insert(notificationPreference).values([
    {
      userId: ADMIN_ID,
      paymentEmail: true,
      endingSoonEmail: false,
      quietStart: "22:00",
      quietEnd: "07:00",
    },
    { userId: USER1_ID, outbidPush: true, wonEmail: true, paymentEmail: true },
    { userId: USER2_ID, outbidEmail: true, lotEndedSellerEmail: true, paymentEmail: true },
    { userId: GALLERY_ADMIN_ID, paymentEmail: true, watchlistEmail: true },
    { userId: GALLERY_FINANCE_ID, paymentEmail: true, lotEndedSellerEmail: true },
    { userId: ESTATE_OWNER_ID, paymentEmail: true, wonEmail: true, outbidEmail: true },
    { userId: COMPANY_OWNER_ID, paymentEmail: true },
    { userId: CONSIGNOR_ID, lotEndedSellerEmail: true },
    { userId: BUYER_AGENT_ID, outbidPush: true, wonEmail: true },
  ]);

  // ── User invitations ────────────────────────────────────────────────────────
  // tokenHash values are deterministic fakes; real tokens are 32 random bytes → SHA-256.
  await db.insert(userInvitation).values([
    // ── Platform invitations ─────────────────────────────────────────────────
    /** pending — admin has invited a prospective second finance ops user. */
    {
      id: INV.pendingPlatform,
      email: "new-accountant@example.com",
      targetRole: "staff",
      targetStaffRole: "finance_ops",
      tokenHash: "seed_hash_platform_pending_accountant_0000000000000001",
      status: "pending",
      expiresAt: new Date(now + 7 * day),
      createdByUserId: ADMIN_ID,
    },
    /** accepted — the finance_ops invitation that created ACCOUNTANT_ID. */
    {
      email: "accountant@lax.bid",
      targetRole: "staff",
      targetStaffRole: "finance_ops",
      tokenHash: "seed_hash_platform_accepted_accountant_000000000000002",
      status: "accepted",
      expiresAt: new Date(now + 7 * day),
      acceptedAt: new Date(now - 149 * day),
      acceptedUserId: ACCOUNTANT_ID,
      createdByUserId: ADMIN_ID,
      createdAt: new Date(now - 151 * day),
      updatedAt: new Date(now - 149 * day),
    },
    /** revoked — admin retracted a pending super_admin invite. */
    {
      email: "revoked-admin@example.com",
      targetRole: "staff",
      targetStaffRole: "super_admin",
      tokenHash: "seed_hash_platform_revoked_admin_0000000000000000003",
      status: "revoked",
      expiresAt: new Date(now + 3 * day),
      createdByUserId: ADMIN_ID,
      createdAt: new Date(now - 10 * day),
      updatedAt: new Date(now - 2 * day),
    },
    /** expired — a client invitation whose 7-day window has passed. */
    {
      email: "expired-client@example.com",
      targetRole: "client",
      tokenHash: "seed_hash_platform_expired_client_00000000000000004",
      status: "expired",
      expiresAt: new Date(now - 1 * day),
      createdByUserId: ADMIN_ID,
      createdAt: new Date(now - 8 * day),
      updatedAt: new Date(now - 1 * day),
    },

    // ── Entity invitations ───────────────────────────────────────────────────
    /** accepted — the gallery consignor invitation that CONSIGNOR_ID accepted. */
    {
      email: "consignor@lax.bid",
      targetRole: "client",
      targetLegalEntityId: LE.gallery,
      targetLegalEntityMemberRole: "consignor",
      tokenHash: "seed_hash_entity_accepted_consignor_00000000000005",
      status: "accepted",
      expiresAt: new Date(now + 7 * day),
      acceptedAt: new Date(now - 34 * day),
      acceptedUserId: CONSIGNOR_ID,
      createdByUserId: GALLERY_ADMIN_ID,
      createdAt: new Date(now - 35 * day),
      updatedAt: new Date(now - 34 * day),
    },
    /** pending — gallery is waiting on a new admin to accept. */
    {
      email: "future-gallery-admin@example.com",
      targetRole: "client",
      targetLegalEntityId: LE.gallery,
      targetLegalEntityMemberRole: "admin",
      tokenHash: "seed_hash_entity_pending_gallery_admin_000000000006",
      status: "pending",
      expiresAt: new Date(now + 5 * day),
      createdByUserId: GALLERY_ADMIN_ID,
    },
    /** revoked — a buyer_agent invitation that was withdrawn before acceptance. */
    {
      email: "withdrawn-buyer-agent@example.com",
      targetRole: "client",
      targetLegalEntityId: LEO.otherRestricted,
      targetLegalEntityMemberRole: "buyer_agent",
      tokenHash: "seed_hash_entity_revoked_buyer_agent_0000000000007",
      status: "revoked",
      expiresAt: new Date(now + 7 * day),
      createdByUserId: ESTATE_OWNER_ID,
      createdAt: new Date(now - 20 * day),
      updatedAt: new Date(now - 15 * day),
    },
    /** pending — Northbank has sent a viewer invitation to a potential partner. */
    {
      email: "partner-viewer@example.com",
      targetRole: "client",
      targetLegalEntityId: LE.gallery,
      targetLegalEntityMemberRole: "viewer",
      tokenHash: "seed_hash_entity_pending_viewer_0000000000000000008",
      status: "pending",
      expiresAt: new Date(now + 6 * day),
      createdByUserId: GALLERY_ADMIN_ID,
    },
  ]);

  // ── Categories ─────────────────────────────────────────────────────────────
  await db.insert(category).values([
    { id: CAT.paintings, name: "Paintings", slug: "paintings", parentId: null },
    { id: CAT.sculpture, name: "Sculpture", slug: "sculpture", parentId: null },
    { id: CAT.photography, name: "Photography", slug: "photography", parentId: null },
    { id: CAT.digital, name: "Digital Art", slug: "digital-art", parentId: null },
    { id: CAT.mixed, name: "Mixed Media", slug: "mixed-media", parentId: null },
    { id: CAT.drawings, name: "Drawings", slug: "drawings", parentId: null },
    { id: CAT.finePrints, name: "Fine Prints", slug: "fine-prints", parentId: null },
    { id: CAT.contemporary, name: "Contemporary", slug: "contemporary", parentId: CAT.paintings },
    {
      id: CAT.impressionist,
      name: "Impressionist",
      slug: "impressionist",
      parentId: CAT.paintings,
    },
    { id: CAT.bronze, name: "Bronze", slug: "bronze", parentId: CAT.sculpture },
    // ── New collecting departments for the creator-kind registry ─────────────
    { id: CAT.motorCars, name: "Motor Cars", slug: "motor-cars", parentId: null },
    { id: CAT.watches, name: "Watches & Clocks", slug: "watches-clocks", parentId: null },
    { id: CAT.books, name: "Books & Manuscripts", slug: "books-manuscripts", parentId: null },
    { id: CAT.coins, name: "Coins & Medals", slug: "coins-medals", parentId: null },
    {
      id: CAT.design,
      name: "Design & Decorative Arts",
      slug: "design-decorative-arts",
      parentId: null,
    },
    { id: CAT.jewellery, name: "Jewellery", slug: "jewellery", parentId: null },
    { id: CAT.antiques, name: "Antiques", slug: "antiques", parentId: null },
    { id: CAT.memorabilia, name: "Memorabilia", slug: "memorabilia", parentId: null },
  ]);

  // ── Artist profiles ────────────────────────────────────────────────────────
  await db.insert(artistProfile).values([
    {
      id: ARTIST.carolina,
      displayName: "Carolina Price",
      slug: "carolina-price",
      portraitUrl: IMG.a,
      heroImageUrl: IMG.b,
      shortBio:
        "London-based painter and mixed-media artist focused on light, surface, and memory.",
      longBio:
        "Carolina Price works across oil, pigment, and assemblage. This catalogue profile is admin-curated (same model as production): it drives public artist pages, lot attribution via lot.artist_id, and featured states.",
      nationality: "British",
      location: "London, UK",
      countryCode: "GB",
      birthYear: "1990",
      websiteUrl: "https://example.com/carolina-price",
      socialLinks: { instagram: "https://instagram.com/carolina.seed" },
      attributes: { movement: "Contemporary Abstraction", medium: "Oil on canvas" },
      featured: true,
      verified: true,
      kind: "artist",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 60 * day),
      reviewNotes:
        "Seeded approved profile: Eleanor (admin) created the catalogue row; optional owner_user_id links Carolina the client for seller-is-maker demos; legal entity remains consignment/settlement identity.",
      ownerUserId: USER2_ID,
      ownerLegalEntityId: LE.user2,
      createdAt: new Date(now - 90 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.robert,
      displayName: "Robert Thorne Studio",
      slug: "robert-thorne-studio",
      portraitUrl: IMG.c,
      heroImageUrl: IMG.d,
      shortBio:
        "Admin-curated catalogue profile for Robert Thorne (client): registry + lot attribution demos.",
      nationality: "British",
      location: "Manchester, UK",
      countryCode: "GB",
      birthYear: "1982",
      socialLinks: {},
      attributes: { movement: "Figurative", medium: "Acrylic" },
      featured: false,
      verified: true,
      kind: "artist",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 50 * day),
      reviewNotes:
        "Seeded secondary approved profile: created by platform admin; owner_user_id links the consigning client user1 for optional linked-maker metadata.",
      ownerUserId: USER1_ID,
      ownerLegalEntityId: LE.user1,
      createdAt: new Date(now - 70 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.pendingStudio,
      displayName: "Northbank Studio Archive",
      slug: "northbank-studio-archive",
      shortBio:
        "Pending maker catalogue row created by admin on behalf of the gallery org (merge/review queue demos).",
      nationality: "British",
      location: "London, UK",
      countryCode: "GB",
      socialLinks: {},
      attributes: { discipline: "Ceramics", materials: "Stoneware, porcelain" },
      featured: false,
      verified: false,
      kind: "maker",
      status: "pending",
      createdByUserId: ADMIN_ID,
      ownerLegalEntityId: LE.gallery,
      createdAt: new Date(now - 5 * day),
      updatedAt: stamp,
    },
    // ── New creator-kind registry profiles ────────────────────────────────────
    {
      id: ARTIST.ferrarispa,
      displayName: "Ferrari S.p.A.",
      slug: "ferrari-spa",
      shortBio: "Italian sports-car marque founded by Enzo Ferrari in Maranello, 1939.",
      longBio:
        "Ferrari S.p.A. is one of the world's most celebrated automotive marques. Its road and racing cars have appeared at major auction houses since the 1980s, with rare models regularly achieving record results.",
      nationality: "Italian",
      location: "Maranello, Italy",
      countryCode: "IT",
      foundedYear: "1939",
      websiteUrl: "https://www.ferrari.com",
      socialLinks: {},
      attributes: {
        countryOfOrigin: "Italy",
        founderName: "Enzo Ferrari",
        parentCompany: "Stellantis (partial)",
        status: "Active",
      },
      featured: true,
      verified: true,
      kind: "marque",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 30 * day),
      createdAt: new Date(now - 45 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.patekPhilippe,
      displayName: "Patek Philippe SA",
      slug: "patek-philippe-sa",
      shortBio:
        "Swiss watchmaker founded in Geneva, 1839. Produces some of the world's most collectible timepieces.",
      nationality: "Swiss",
      location: "Geneva, Switzerland",
      countryCode: "CH",
      foundedYear: "1839",
      websiteUrl: "https://www.patek.com",
      socialLinks: {},
      attributes: {
        headquarters: "Geneva, Switzerland",
        parentCompany: "Stern family (private)",
      },
      featured: true,
      verified: true,
      kind: "manufacturer",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 20 * day),
      createdAt: new Date(now - 35 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.janeAusten,
      displayName: "Jane Austen",
      slug: "jane-austen",
      shortBio:
        "English novelist (1775–1817), author of Sense and Sensibility, Pride and Prejudice, and Emma.",
      longBio:
        "Jane Austen's manuscripts, first editions, and personal correspondence are among the most sought-after items in the books and manuscripts market, attracting bibliophiles and literary collectors worldwide.",
      nationality: "British",
      location: "Steventon, Hampshire, England",
      countryCode: "GB",
      birthYear: "1775",
      deathYear: "1817",
      socialLinks: {},
      attributes: {
        penNames: "A Lady",
        languages: "English",
        genres: "Novel, Romance, Social satire",
      },
      featured: false,
      verified: true,
      kind: "author",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 14 * day),
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.royalMint,
      displayName: "The Royal Mint",
      slug: "the-royal-mint",
      shortBio: "The official mint of the United Kingdom, producing coins since 886 AD.",
      nationality: "British",
      location: "Llantrisant, Wales, UK",
      countryCode: "GB",
      foundedYear: "886",
      websiteUrl: "https://www.royalmint.com",
      socialLinks: {},
      attributes: {
        mintMarks: "Various (see catalogue)",
        location: "Llantrisant, Wales",
        region: "United Kingdom",
      },
      featured: false,
      verified: true,
      kind: "mint",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 10 * day),
      createdAt: new Date(now - 15 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.northbankDesign,
      displayName: "Northbank Design Studio",
      slug: "northbank-design-studio",
      shortBio:
        "London-based design and furniture studio founded in 2001, specialising in limited-edition objects.",
      nationality: "British",
      location: "Shoreditch, London, UK",
      countryCode: "GB",
      foundedYear: "2001",
      socialLinks: {},
      attributes: {
        foundedLocation: "Shoreditch, London",
        principals: "Marcus Webb, Lily Chen",
      },
      featured: false,
      verified: false,
      kind: "studio",
      status: "approved",
      createdByUserId: ADMIN_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 3 * day),
      createdAt: new Date(now - 6 * day),
      updatedAt: stamp,
    },
  ]);

  // ── Artist categories (department associations) ─────────────────────────────
  await db.insert(artistCategories).values([
    // Original artist profiles → fine-art departments
    { artistProfileId: ARTIST.carolina, categoryId: CAT.paintings, sortOrder: 0 },
    { artistProfileId: ARTIST.carolina, categoryId: CAT.mixed, sortOrder: 1 },
    { artistProfileId: ARTIST.robert, categoryId: CAT.paintings, sortOrder: 0 },
    // pendingStudio: decorative arts / design
    { artistProfileId: ARTIST.pendingStudio, categoryId: CAT.design, sortOrder: 0 },
    // New kind profiles → matching departments
    { artistProfileId: ARTIST.ferrarispa, categoryId: CAT.motorCars, sortOrder: 0 },
    { artistProfileId: ARTIST.patekPhilippe, categoryId: CAT.watches, sortOrder: 0 },
    { artistProfileId: ARTIST.janeAusten, categoryId: CAT.books, sortOrder: 0 },
    { artistProfileId: ARTIST.royalMint, categoryId: CAT.coins, sortOrder: 0 },
    { artistProfileId: ARTIST.northbankDesign, categoryId: CAT.design, sortOrder: 0 },
  ]);

  await db.insert(artistAlias).values([
    {
      artistProfileId: ARTIST.carolina,
      alias: "C. Price",
      kind: "signature",
      createdByUserId: ADMIN_ID,
    },
    {
      artistProfileId: ARTIST.carolina,
      alias: "Carolina P.",
      kind: "synonym",
      createdByUserId: ADMIN_ID,
    },
    {
      artistProfileId: ARTIST.pendingStudio,
      alias: "Northbank Archive",
      kind: "proposed",
      createdByUserId: ADMIN_ID,
    },
  ]);

  // ── Sale + lot dates ────────────────────────────────────────────────────────
  const activeEnd = new Date(now + 10 * day);
  const activeStart = new Date(now - 2 * day);
  const scheduledStart = new Date(now + 3 * day);
  const scheduledEnd = new Date(now + 20 * day);
  const endedEnd = new Date(now - 30 * day);
  const endedStart = new Date(now - 60 * day);
  const draftStart = new Date(now + 1 * day);
  const draftEnd = new Date(now + 30 * day);
  const soonEnd = new Date(now + 2 * day);

  const lotMarketingDetails = (
    low: string,
    high: string,
    imageAlts: string[],
    extra: Record<string, unknown> = {},
  ) => ({
    estimate: { low, high, currency: "USD" },
    imageAlts,
    ...extra,
  });

  // ── Sales ──────────────────────────────────────────────────────────────────
  const saleRows: (Omit<typeof sale.$inferInsert, "createdByLegalEntityId"> & {
    categoryId: string | null;
    createdBy: string;
  })[] = [
    {
      id: S.evening,
      title: "Spring Contemporary Evening Sale",
      description:
        "A tightly curated evening auction anchored by contemporary painting, sculpture, and collector-grade provenance.",
      coverImages: [IMG.a, IMG.b, IMG.a],
      categoryId: CAT.paintings,
      deliveryMode: "onsite",
      locationName: "LAX Mayfair Saleroom",
      locationAddress: "12 King Street, St James's, London SW1Y 6QU",
      locationMapUrl: "https://maps.google.com/?q=12+King+Street+London",
      streamUrl: "https://www.youtube.com/watch?v=AtO699gsFS8&t=11s",
      status: "active",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      previewStartTime: new Date(now - 1 * day),
      buyerPremiumRate: "0.15",
      buyerPremiumTiers: [
        { hammerThresholdMinor: 0, rate: "0.1500" },
        { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
      ],
      terms:
        "LAX London Auction House buyer's premium is 15% on hammer up to £500,000 and 10% at or above £500,000 (band-based on the whole hammer); full conditions of sale apply.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: S.online,
      title: "Modern Masters Online Sale",
      description:
        "Online-only sale of modern editions, works on paper, and digital practice from private collections.",
      coverImages: [IMG.c, IMG.d],
      categoryId: null,
      deliveryMode: "online",
      streamUrl: null,
      status: "active",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      previewStartTime: new Date(now + 1 * day),
      buyerPremiumRate: "0.25",
      terms: "Online bidding closes lot-by-lot; LAX London Auction House buyer's premium is 25%.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: S.hybridA,
      title: "Hybrid Day Sale — Room A (Modern)",
      description:
        "Hybrid saleroom running live online and in-room. Room A is mid-session with a lot on the block.",
      coverImages: [IMG.a, IMG.c],
      categoryId: CAT.paintings,
      deliveryMode: "hybrid",
      locationName: "LAX Mayfair Saleroom — Room A",
      locationAddress: "12 King Street, St James's, London SW1Y 6QU",
      locationMapUrl: "https://maps.google.com/?q=12+King+Street+London",
      streamUrl: "https://www.youtube.com/watch?v=AtO699gsFS8&t=11s",
      status: "active",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      previewStartTime: new Date(now - 1 * day),
      buyerPremiumRate: "0.20",
      terms: "Hybrid sale: online + in-room paddle bidding. Buyer's premium 20%.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: S.hybridB,
      title: "Hybrid Day Sale — Room B (Works on Paper)",
      description:
        "Hybrid saleroom running live online and in-room. Room B is between lots — the clerk advances next.",
      coverImages: [IMG.d, IMG.e],
      categoryId: CAT.drawings,
      deliveryMode: "hybrid",
      locationName: "LAX Mayfair Saleroom — Room B",
      locationAddress: "12 King Street, St James's, London SW1Y 6QU",
      locationMapUrl: "https://maps.google.com/?q=12+King+Street+London",
      streamUrl: "https://www.youtube.com/watch?v=AtO699gsFS8&t=11s",
      status: "active",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      previewStartTime: new Date(now - 1 * day),
      buyerPremiumRate: "0.20",
      terms: "Hybrid sale: online + in-room paddle bidding. Buyer's premium 20%.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: S.hybridC,
      title: "Hybrid Day Sale — Room C (Sculpture)",
      description:
        "Hybrid saleroom currently paused for a short break. Resume to continue the run.",
      coverImages: [IMG.b, IMG.a],
      categoryId: CAT.paintings,
      deliveryMode: "hybrid",
      locationName: "LAX Mayfair Saleroom — Room C",
      locationAddress: "12 King Street, St James's, London SW1Y 6QU",
      locationMapUrl: "https://maps.google.com/?q=12+King+Street+London",
      streamUrl: "https://www.youtube.com/watch?v=AtO699gsFS8&t=11s",
      status: "active",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      previewStartTime: new Date(now - 1 * day),
      buyerPremiumRate: "0.20",
      terms: "Hybrid sale: online + in-room paddle bidding. Buyer's premium 20%.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    (() => {
      const demo = buildPressDemoSaleRow(now, day);
      return {
        id: demo.id,
        title: demo.title,
        description: demo.description,
        coverImages: demo.coverImages,
        categoryId: CAT.paintings,
        deliveryMode: demo.deliveryMode,
        locationName: demo.locationName,
        locationAddress: demo.locationAddress,
        locationMapUrl: demo.locationMapUrl,
        streamUrl: demo.streamUrl,
        status: demo.status,
        startTime: demo.startTime,
        endTime: demo.endTime,
        previewStartTime: demo.previewStartTime,
        buyerPremiumRate: demo.buyerPremiumRate,
        terms: demo.terms,
        auctionDayImages: demo.auctionDayImages,
        pressCoverage: demo.pressCoverage,
        createdBy: ADMIN_ID,
        createdAt: demo.createdAt,
        updatedAt: demo.updatedAt,
      };
    })(),
  ];

  await db.insert(venue).values([
    {
      id: VENUE.mayfair,
      legalEntityId: LEO.laxStockApproved,
      name: "LAX Mayfair Saleroom",
      slug: "lax-mayfair-saleroom",
      addressLine1: "12 King Street",
      addressLine2: "St James's",
      city: "London",
      county: null,
      postcode: "SW1Y 6QU",
      country: "United Kingdom",
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=12%20King%20Street%2C%20St%20James%27s%2C%20London%20SW1Y%206QU",
      photos: [],
      status: "active",
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);

  await db.insert(sale).values(
    saleRows.map(({ categoryId: _categoryId, createdBy: _createdBy, ...row }) => ({
      ...row,
      createdByLegalEntityId: LEO.laxStockApproved,
    })),
  );
  await db.insert(saleCategories).values(
    saleRows
      .filter((row) => row.categoryId != null)
      .map((row) => ({
        saleId: row.id as string,
        categoryId: row.categoryId as string,
        sortOrder: 0,
      })),
  );

  // ── Lots ───────────────────────────────────────────────────────────────────
  type LotRow = Omit<typeof lot.$inferInsert, "sellerLegalEntityId"> & {
    categoryId: string;
    sellerId: string;
    /** Override seller entity when it differs from the consignor's personal profile (e2e Connect block). */
    sellerLegalEntityId?: string;
  };

  type HybridLotSpec = {
    id: string;
    num: number;
    title: string;
    status: "scheduled" | "active" | "ended";
    sold?: boolean;
  };

  const hybridLotRows = (saleId: string, specs: readonly HybridLotSpec[]): LotRow[] =>
    specs.map((spec, index) => {
      const sellerId = index % 2 === 0 ? USER2_ID : USER1_ID;
      const startMinor = 4000 + spec.num * 500;
      const currentMinor = spec.status === "scheduled" ? startMinor : startMinor + 1500;
      return {
        id: spec.id,
        saleId,
        lotNumber: spec.num,
        sellerId,
        artistId: index % 2 === 0 ? ARTIST.carolina : ARTIST.robert,
        title: spec.title,
        description: `${spec.title} — hybrid saleroom demo lot ${spec.num}.`,
        medium: "Mixed media",
        dimensions: "24 × 36 in (61 × 91.4 cm)",
        images: [IMG.a, IMG.c],
        categoryId: CAT.contemporary,
        auctionType: "english",
        startingPrice: `${startMinor}.00`,
        reservePrice: null,
        buyNowPrice: null,
        currentPrice: `${currentMinor}.00`,
        buyerPremiumRate: "0.20",
        minBidIncrement: "100.00",
        startTime: activeStart,
        endTime: activeEnd,
        status: spec.status,
        winnerId: spec.status === "ended" && spec.sold ? USER1_ID : null,
        dutchDecrementAmount: null,
        dutchDecrementIntervalMs: 60_000,
        dutchLastDecrementAt: null,
        marketingDetails: lotMarketingDetails(`${startMinor}.00`, `${currentMinor + 3000}.00`, [
          `${spec.title} — hybrid demo`,
        ]),
      } satisfies LotRow;
    });

  const lotRows: LotRow[] = [
    {
      id: L.ethereal,
      saleId: S.evening,
      lotNumber: 1,
      sellerId: USER2_ID,
      // Canonical artist attribution (post-consolidation). The legacy
      // `marketing_details.sellerArtistId` JSON copy has been retired; admins
      // now manage the link via the ArtistPicker -> lot.artist_id FK.
      artistId: ARTIST.carolina,
      title: "Ethereal Form & Found Light",
      description:
        "A large-scale abstract composition exploring luminosity and negative space. Oil and gold leaf on linen.",
      medium: "Oil and gold leaf on linen",
      dimensions: "72 × 96 in (182.9 × 243.8 cm)",
      images: [IMG.a, IMG.b],
      categoryId: CAT.contemporary,
      auctionType: "english",
      startingPrice: "100000.00",
      reservePrice: "120000.00",
      buyNowPrice: null,
      currentPrice: "155000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "500.00",
      startTime: activeStart,
      endTime: activeEnd,
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: {
        estimate: { low: "140000.00", high: "190000.00", currency: "USD" },
        conditionReport: {
          summary:
            "Excellent overall condition; stable paint layer with minor craquelure in lower quadrant (documented).",
        },
        provenance: [
          { period: "2022", note: "Acquired from the artist's studio by the consignor." },
          { note: "Private collection, London." },
        ],
        imageAlts: [
          "Ethereal Form & Found Light — installation view",
          "Ethereal Form & Found Light — detail of gold leaf",
        ],
      },
    },
    {
      id: L.winter,
      saleId: S.evening,
      lotNumber: 2,
      sellerId: USER2_ID,
      title: "The Winter Study",
      description:
        "Atmospheric interior study with a restrained winter palette and finely worked surface.",
      medium: "Oil on canvas",
      dimensions: "40 × 30 in (101.6 × 76.2 cm)",
      images: [IMG.c],
      categoryId: CAT.impressionist,
      auctionType: "english",
      startingPrice: "70000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "88000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "250.00",
      startTime: activeStart,
      endTime: new Date(now + 7 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("70000.00", "95000.00", [
        "The Winter Study — framed canvas view",
      ]),
    },
    {
      id: L.anatomy,
      saleId: S.evening,
      lotNumber: 3,
      sellerId: USER1_ID,
      title: "Anatomy of Light",
      description: "Minimalist bronze and plaster sculpture with precise architectural balance.",
      medium: "Bronze, plaster",
      dimensions: "24 × 18 × 14 in",
      images: [IMG.d],
      categoryId: CAT.bronze,
      auctionType: "english",
      startingPrice: "40000.00",
      reservePrice: "50000.00",
      buyNowPrice: null,
      currentPrice: "55000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: new Date(now + 5 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("45000.00", "65000.00", [
        "Anatomy of Light — three-quarter sculpture view",
      ]),
    },
    {
      id: L.chromatic,
      saleId: S.evening,
      lotNumber: 4,
      sellerId: USER2_ID,
      title: "Chromatic Resonance",
      description:
        "Large geometric color-field panel with archival pigments and a high-saturation finish.",
      medium: "Pigment on panel",
      dimensions: "60 × 60 in",
      images: [IMG.b, IMG.a],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "180000.00",
      reservePrice: "200000.00",
      buyNowPrice: null,
      currentPrice: "210000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1000.00",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("190000.00", "240000.00", [
        "Chromatic Resonance — full panel view",
        "Chromatic Resonance — pigment surface detail",
      ]),
    },
    {
      id: L.suspended,
      saleId: S.evening,
      lotNumber: 5,
      sellerId: USER2_ID,
      title: "Suspended Memory",
      description:
        "Mixed-media assemblage combining encaustic, paper fragments, and found studio objects.",
      medium: "Encaustic, found objects",
      dimensions: "36 × 48 in",
      images: [IMG.c],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "25000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "34000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "50.00",
      startTime: activeStart,
      endTime: new Date(now + 4 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("28000.00", "38000.00", [
        "Suspended Memory — assemblage front view",
      ]),
    },
    {
      id: L.void,
      saleId: S.online,
      lotNumber: 1,
      sellerId: USER2_ID,
      title: "Void and Presence",
      description:
        "Editioned digital print offered in an online English auction, with crisp tonal contrast and certificate.",
      medium: "Digital print, edition 1/8",
      dimensions: "32 × 32 in",
      images: [IMG.d],
      categoryId: CAT.digital,
      auctionType: "english",
      startingPrice: "120000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "95000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: activeStart,
      endTime: new Date(now + 6 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("90000.00", "120000.00", [
        "Void and Presence — editioned print view",
      ]),
    },
    {
      id: L.nocturnal,
      saleId: S.online,
      lotNumber: 2,
      sellerId: USER1_ID,
      title: "Nocturnal Atlas",
      description:
        "Large-format nocturne from a small edition, printed with deep blacks and luminous highlights.",
      medium: "Archival pigment print",
      dimensions: "48 × 72 in",
      images: [IMG.a],
      categoryId: CAT.photography,
      auctionType: "english",
      startingPrice: "130000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "120000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      status: "scheduled",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("110000.00", "145000.00", [
        "Nocturnal Atlas — large-format photograph",
      ]),
    },
    {
      id: L.silent,
      saleId: S.online,
      lotNumber: 3,
      sellerId: USER1_ID,
      title: "Silent Architecture",
      description:
        "Precise ink architectural composition offered in a timed English auction for private collectors.",
      medium: "Ink on paper",
      dimensions: "22 × 30 in",
      images: [IMG.b],
      categoryId: CAT.sculpture,
      auctionType: "english",
      startingPrice: "50000.00",
      reservePrice: "60000.00",
      buyNowPrice: null,
      currentPrice: "67000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: activeStart,
      endTime: new Date(now + 8 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("60000.00", "80000.00", [
        "Silent Architecture — ink drawing",
      ]),
    },
    {
      id: L.golden,
      saleId: null,
      lotNumber: null,
      sellerId: USER1_ID,
      title: "Golden Meridian",
      description:
        "Certified contemporary edition sold after competitive English bidding, with warm metallic tonality.",
      medium: "Giclée on cotton rag",
      dimensions: "18 × 24 in",
      images: [IMG.c],
      categoryId: CAT.digital,
      auctionType: "english",
      startingPrice: "28000.00",
      reservePrice: null,
      buyNowPrice: "28000.00",
      currentPrice: "28000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: new Date(now - 20 * day),
      endTime: new Date(now - 14 * day),
      status: "ended",
      winnerId: USER2_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("25000.00", "32000.00", [
        "Golden Meridian — edition print",
      ]),
    },
    {
      id: L.amber,
      saleId: S.online,
      lotNumber: 4,
      sellerId: USER2_ID,
      title: "The Amber Hours",
      description:
        "Museum-scale oil on canvas from a private collection, sold with documented provenance.",
      medium: "Oil on canvas",
      dimensions: "55 × 70 in",
      images: [IMG.a, IMG.d],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "300000.00",
      reservePrice: "350000.00",
      buyNowPrice: null,
      currentPrice: "420000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "5000.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: USER1_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("350000.00", "450000.00", [
        "The Amber Hours — full canvas view",
        "The Amber Hours — surface detail",
      ]),
    },
    {
      id: L.marginal,
      saleId: S.online,
      lotNumber: 5,
      sellerId: USER2_ID,
      title: "Marginal Figures",
      description:
        "Expressive figurative study in charcoal and ink, sold from a private works-on-paper group.",
      medium: "Charcoal, ink",
      dimensions: "30 × 40 in",
      images: [IMG.b],
      categoryId: CAT.drawings,
      auctionType: "english",
      startingPrice: "80000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "115000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "500.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: USER1_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("90000.00", "125000.00", [
        "Marginal Figures — charcoal and ink study",
      ]),
    },
    {
      id: L.recursive,
      saleId: null,
      lotNumber: null,
      sellerId: USER1_ID,
      title: "Recursive Dreams",
      description:
        "Acrylic composition approved for cataloguing and awaiting assignment to a future sale.",
      medium: "Acrylic on board",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "15000.00",
      reservePrice: "18000.00",
      buyNowPrice: null,
      currentPrice: "15000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "25.00",
      startTime: draftStart,
      endTime: draftEnd,
      status: "draft",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("15000.00", "22000.00", [
        "Recursive Dreams — acrylic on board",
      ]),
    },
    {
      id: L.connectBlockedDraft,
      saleId: null,
      lotNumber: null,
      sellerId: GALLERY_ADMIN_ID,
      sellerLegalEntityId: LE.restrictedDealer,
      title: "Coastal Ledger (Connect blocked seed)",
      description:
        "Draft lot assigned to Cedar & Stone Fine Art — Connect payouts incomplete for admin publish gating e2e.",
      medium: "Mixed media on paper",
      dimensions: "18 × 24 in",
      images: [IMG.c],
      categoryId: CAT.contemporary,
      auctionType: "english",
      startingPrice: "8000.00",
      reservePrice: "10000.00",
      buyNowPrice: null,
      currentPrice: "8000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "25.00",
      startTime: draftStart,
      endTime: draftEnd,
      status: "draft",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("8000.00", "12000.00", [
        "Coastal Ledger — connect-blocked seller seed lot",
      ]),
    },
    {
      id: L.cancelledLot,
      saleId: null,
      lotNumber: null,
      sellerId: USER1_ID,
      title: "River Light (withdrawn)",
      description: "Withdrawn watercolor study retained for admin workflow testing.",
      medium: "Watercolor",
      dimensions: "12 × 16 in",
      images: [IMG.e],
      categoryId: CAT.finePrints,
      auctionType: "english",
      startingPrice: "5000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "5000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: soonEnd,
      status: "cancelled",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("5000.00", "7000.00", [
        "River Light withdrawn watercolor study",
      ]),
    },
    {
      id: L.futureStudy,
      saleId: null,
      lotNumber: null,
      sellerId: USER2_ID,
      title: "November Graphite Study",
      description:
        "Graphite study prepared for a future English auction with a documented reserve.",
      medium: "Graphite",
      dimensions: "11 × 14 in",
      images: [IMG.c],
      categoryId: CAT.drawings,
      auctionType: "english",
      startingPrice: "12000.00",
      reservePrice: "15000.00",
      buyNowPrice: null,
      currentPrice: "12000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      status: "scheduled",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("12000.00", "18000.00", [
        "November Graphite Study — graphite drawing",
      ]),
    },
    {
      id: L.paperThin,
      saleId: null,
      lotNumber: null,
      sellerId: USER1_ID,
      title: "Paper Thin Horizon",
      description:
        "Delicate graphite and silverpoint horizon study on toned paper, framed under UV glass.",
      medium: "Silverpoint",
      dimensions: "9 × 12 in",
      images: [IMG.e],
      categoryId: CAT.drawings,
      auctionType: "english",
      startingPrice: "3200.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "3200.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "50.00",
      startTime: activeStart,
      endTime: new Date(now + 3 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("3000.00", "5000.00", [
        "Paper Thin Horizon — silverpoint drawing",
      ]),
    },
    {
      id: L.riverStudy,
      saleId: null,
      lotNumber: null,
      sellerId: USER2_ID,
      title: "River Study — Blue Hour",
      description:
        "Small plein-air oil panel from a winter residency, notable for its blue-hour palette.",
      medium: "Oil on panel",
      dimensions: "10 × 12 in",
      images: [IMG.a],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "4500.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "5200.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: new Date(now + 9 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      marketingDetails: lotMarketingDetails("4500.00", "6500.00", [
        "River Study Blue Hour — oil panel",
      ]),
    },
    // ── Hybrid Room A lots (5 lots; lot 3 on the block, 1-2 already sold) ───────
    ...hybridLotRows(S.hybridA, [
      { id: L.hybridA1, num: 1, title: "Aurora Field No. 1", status: "ended", sold: true },
      { id: L.hybridA2, num: 2, title: "Concrete Bloom", status: "ended", sold: false },
      { id: L.hybridA3, num: 3, title: "Meridian Drift", status: "active" },
      { id: L.hybridA4, num: 4, title: "Glass Horizon", status: "scheduled" },
      { id: L.hybridA5, num: 5, title: "Late Signal", status: "scheduled" },
    ]),
    // ── Hybrid Room B lots (4 lots; first two done, between lots) ───────────────
    ...hybridLotRows(S.hybridB, [
      { id: L.hybridB1, num: 1, title: "Folded Light Study", status: "ended", sold: true },
      { id: L.hybridB2, num: 2, title: "Quiet Margin", status: "ended", sold: true },
      { id: L.hybridB3, num: 3, title: "Tidewater Sketch", status: "scheduled" },
      { id: L.hybridB4, num: 4, title: "Northbank Notation", status: "scheduled" },
    ]),
    // ── Hybrid Room C lots (3 lots; paused before lot 2) ───────────────────────
    ...hybridLotRows(S.hybridC, [
      { id: L.hybridC1, num: 1, title: "Cast Shadow I", status: "ended", sold: true },
      { id: L.hybridC2, num: 2, title: "Cast Shadow II", status: "scheduled" },
      { id: L.hybridC3, num: 3, title: "Cast Shadow III", status: "scheduled" },
    ]),
  ];
  await db.insert(lot).values(
    lotRows.map(
      ({ categoryId: _categoryId, sellerId, sellerLegalEntityId: explicitSellerLe, ...row }) => ({
        ...row,
        sellerLegalEntityId: explicitSellerLe ?? legalEntityIdForUser(sellerId),
      }),
    ),
  );
  await db.insert(lotCategories).values(
    lotRows.map((row) => ({
      lotId: row.id as string,
      categoryId: row.categoryId,
      sortOrder: 0,
    })),
  );

  // ── Saleroom sessions (hybrid live grid / clerk console demo) ───────────────
  const SESSION = {
    hybridA: "f1000001-0000-4000-8000-000000000001",
    hybridB: "f1000002-0000-4000-8000-000000000002",
    hybridC: "f1000003-0000-4000-8000-000000000003",
  } as const;
  await db.insert(saleroomSession).values([
    {
      id: SESSION.hybridA,
      saleId: S.hybridA,
      status: "live",
      currentLotId: L.hybridA3,
      startedAt: new Date(now - 40 * 60_000),
      clerkUserId: STAFF_AUCTION_MGR_ID,
      auctioneerUserId: STAFF_OPERATIONS_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: SESSION.hybridB,
      saleId: S.hybridB,
      status: "live",
      currentLotId: null,
      startedAt: new Date(now - 25 * 60_000),
      clerkUserId: STAFF_OPERATIONS_ID,
      auctioneerUserId: STAFF_AUCTION_MGR_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: SESSION.hybridC,
      saleId: S.hybridC,
      status: "paused",
      currentLotId: null,
      startedAt: new Date(now - 55 * 60_000),
      clerkUserId: STAFF_AUCTION_MGR_ID,
      auctioneerUserId: STAFF_OPERATIONS_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);
  await db.insert(saleroomEvent).values([
    {
      sessionId: SESSION.hybridA,
      kind: "opened",
      payload: {},
      actorUserId: STAFF_AUCTION_MGR_ID,
      occurredAt: new Date(now - 40 * 60_000),
    },
    {
      sessionId: SESSION.hybridA,
      kind: "hammer",
      payload: { lotId: L.hybridA1, amountMinor: 6_500_00 },
      actorUserId: STAFF_AUCTION_MGR_ID,
      occurredAt: new Date(now - 20 * 60_000),
    },
    {
      sessionId: SESSION.hybridA,
      kind: "no_sale",
      payload: { lotId: L.hybridA2 },
      actorUserId: STAFF_AUCTION_MGR_ID,
      occurredAt: new Date(now - 12 * 60_000),
    },
    {
      sessionId: SESSION.hybridA,
      kind: "advanced_to_lot",
      payload: { lotId: L.hybridA3 },
      actorUserId: STAFF_AUCTION_MGR_ID,
      occurredAt: new Date(now - 8 * 60_000),
    },
    {
      sessionId: SESSION.hybridC,
      kind: "paused",
      payload: {},
      actorUserId: STAFF_AUCTION_MGR_ID,
      occurredAt: new Date(now - 5 * 60_000),
    },
  ]);

  // ── Admin review tasks ──────────────────────────────────────────────────────
  await db.insert(adminReviewTask).values([
    {
      kind: "lot_artist_backfill",
      status: "pending",
      targetLotId: L.suspended,
      payload: {
        suggestedArtistIds: [ARTIST.carolina],
        source: "seed",
        reason: "Lot lacks explicit approved artist attribution.",
      },
      assignedToUserId: ADMIN_ID,
      createdAt: new Date(now - 2 * day),
    },
    {
      kind: "legal_entity_kyb_review",
      status: "in_progress",
      targetLotId: null,
      payload: {
        legalEntityId: LE.restrictedDealer,
        currentlyDue: ["company.verification.document", "external_account"],
      },
      assignedToUserId: ADMIN_ID,
      createdAt: new Date(now - 4 * day),
    },
    {
      kind: "artist_merge_review",
      status: "pending",
      targetLotId: null,
      payload: {
        candidateArtistId: ARTIST.pendingStudio,
        possibleMatchArtistId: ARTIST.carolina,
        confidence: 0.62,
      },
      assignedToUserId: ADMIN_ID,
      createdAt: new Date(now - 1 * day),
    },
  ]);

  // ── Item submissions ────────────────────────────────────────────────────────
  const submissionRows: (Omit<typeof itemSubmission.$inferInsert, "legalEntityId"> & {
    categoryId: string;
    sellerId: string;
  })[] = [
    {
      id: SUB.draft,
      sellerId: USER2_ID,
      title: "Study in Ultramarine",
      description:
        "A compact oil study with strong ultramarine passages, prepared for a future works-on-paper sale.",
      medium: "Oil on paper",
      dimensions: "11 × 14 in",
      images: [IMG.a],
      yearOfWork: "2025",
      isSigned: true,
      signatureNote: "Signed lower right by the artist.",
      edition: null,
      conditionSelfReport: "Very good; minor handling marks at the sheet edge from studio storage.",
      provenance: [{ period: "2025", note: "Consigned directly from the artist's studio." }],
      exhibitions: [],
      askingPrice: "2500.00",
      reservePrice: null,
      categoryId: CAT.paintings,
      submitterNotes:
        "Consignor is gathering the original gallery invoice before formal submission.",
      status: "draft",
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 2 * day),
      updatedAt: new Date(now - 2 * day),
    },
    {
      id: SUB.submitted,
      sellerId: USER1_ID,
      title: "Bronze Maquette — field cast, 2024",
      description:
        "Small bronze maquette acquired directly from a 2024 artist residency, numbered 3/8.",
      medium: "Bronze, cast",
      dimensions: "8 × 6 × 5 in",
      images: [IMG.b],
      yearOfWork: "2024",
      isSigned: true,
      signatureNote: "Incised initials and edition number on underside.",
      edition: "3/8",
      conditionSelfReport: "Excellent; light natural patina variation from casting.",
      provenance: [{ period: "2024", note: "Acquired directly from the artist residency studio." }],
      exhibitions: [{ year: "2024", venue: "Northbank Residency", note: "Open studio preview" }],
      askingPrice: "12000.00",
      reservePrice: "9000.00",
      categoryId: CAT.bronze,
      submitterNotes:
        "Certificate of authenticity and studio invoice are ready for specialist review.",
      status: "submitted",
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 1 * day),
      updatedAt: new Date(now - 1 * day),
    },
    {
      id: SUB.underReview,
      sellerId: CONSIGNOR_ID,
      title: "Landscape with Red Barn — oil on canvas",
      description:
        "Mid-century pastoral scene with strong impasto; consignor holds a 2018 gallery invoice.",
      medium: "Oil on canvas",
      dimensions: "30 × 40 in",
      images: [IMG.c, IMG.a],
      yearOfWork: "1962",
      isSigned: true,
      signatureNote: "Signed lower left.",
      edition: null,
      conditionSelfReport: "Good overall; minor craquelure consistent with age.",
      provenance: [{ period: "2018", note: "Purchased from Northbank Gallery." }],
      exhibitions: [],
      askingPrice: "4500.00",
      reservePrice: "3500.00",
      categoryId: CAT.paintings,
      submitterNotes: "Ready for specialist accept/reject decision.",
      status: "under_review",
      reviewedBy: SPECIALIST_ID,
      reviewedAt: new Date(now - 2 * day),
      reviewNotes: "Provenance verified; awaiting accept decision.",
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 5 * day),
      updatedAt: new Date(now - 2 * day),
    },
    {
      id: SUB.approved,
      sellerId: USER1_ID,
      title: "Ceramic Vessel — studio edition, 2021",
      description:
        "Hand-thrown stoneware vessel with celadon glaze; accepted and awaiting lot conversion.",
      medium: "Stoneware ceramic",
      dimensions: "12 × 8 × 8 in",
      images: [IMG.b, IMG.c],
      yearOfWork: "2021",
      isSigned: true,
      signatureNote: "Incised maker's mark on base.",
      edition: "Studio edition",
      conditionSelfReport: "Excellent; no chips or restoration.",
      provenance: [{ period: "2021", note: "Acquired from the maker's studio sale." }],
      exhibitions: [{ year: "2022", venue: "Clay Works Open", note: "Group show" }],
      askingPrice: "2200.00",
      reservePrice: "1800.00",
      categoryId: CAT.sculpture,
      submitterNotes: "Accepted — ready for catalogue conversion.",
      status: "approved",
      reviewedBy: ADMIN_ID,
      reviewedAt: new Date(now - 1 * day),
      reviewNotes: "Accepted for cataloguing; convert when artist is confirmed.",
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 8 * day),
      updatedAt: new Date(now - 1 * day),
    },
    {
      id: SUB.rejected,
      sellerId: USER2_ID,
      title: "Untitled Digital Collage, 2023",
      description: "Artist-signed digital print submitted with incomplete edition documentation.",
      medium: "Archival inkjet print",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      yearOfWork: "2023",
      isSigned: false,
      signatureNote: "Signature not verified; submitted as an unsigned print.",
      edition: "Edition size unknown",
      conditionSelfReport: "Good print surface; edition documentation incomplete.",
      provenance: [],
      exhibitions: [],
      askingPrice: "800.00",
      reservePrice: null,
      categoryId: CAT.digital,
      submitterNotes:
        "Edition size remains unclear; consignor has contacted the artist for records.",
      status: "rejected",
      reviewedBy: ADMIN_ID,
      reviewedAt: new Date(now - 3 * day),
      reviewNotes: "Editioning and provenance must be documented before relisting.",
      rejectionReason:
        "Insufficient provenance: edition size and artist signature cannot be verified.",
      convertedLotId: null,
      createdAt: new Date(now - 4 * day),
      updatedAt: new Date(now - 3 * day),
    },
    {
      id: SUB.converted,
      sellerId: USER1_ID,
      title: "Recursive Dreams",
      description:
        "Approved intake record for Recursive Dreams, now converted into a catalogued draft lot.",
      medium: "Acrylic on board",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      yearOfWork: "2022",
      isSigned: true,
      signatureNote: "Signed and dated verso.",
      edition: null,
      conditionSelfReport: "Excellent; framed under acrylic with no visible surface issues.",
      provenance: [
        { period: "2022", note: "Purchased from the artist by the current consignor." },
        { note: "Private collection, Manchester." },
      ],
      exhibitions: [{ year: "2023", venue: "LAX Works on Board Preview" }],
      askingPrice: "15000.00",
      reservePrice: "18000.00",
      categoryId: CAT.mixed,
      submitterNotes: "Approved and catalogued; awaiting final sale assignment.",
      status: "converted",
      reviewedBy: ADMIN_ID,
      reviewedAt: new Date(now - 5 * day),
      reviewNotes: "Provenance verified; mapped to draft lot.",
      rejectionReason: null,
      convertedLotId: L.recursive,
      createdAt: new Date(now - 6 * day),
      updatedAt: new Date(now - 5 * day),
    },
  ];
  await db.insert(itemSubmission).values(
    submissionRows.map(({ categoryId: _categoryId, sellerId, ...row }) => ({
      ...row,
      legalEntityId: legalEntityIdForUser(sellerId),
    })),
  );
  await db.insert(submissionCategories).values(
    submissionRows.map((row) => ({
      submissionId: row.id as string,
      categoryId: row.categoryId,
      sortOrder: 0,
    })),
  );

  // ── Bids ───────────────────────────────────────────────────────────────────
  const mkBid = (
    lotId: string,
    bidderId: string,
    amount: string,
    isWinning: boolean,
    agoMs: number,
  ): typeof bid.$inferInsert => ({
    lotId,
    bidderId,
    buyerLegalEntityId: legalEntityIdForUser(bidderId),
    amount,
    isWinning,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: new Date(now - agoMs),
  });

  const bidRows: (typeof bid.$inferInsert)[] = [
    mkBid(L.ethereal, USER1_ID, "115000.00", false, 3 * day),
    mkBid(L.ethereal, GOOGLE_TEST_ID, "130000.00", false, 2 * day),
    mkBid(L.ethereal, APPLE_TEST_ID, "140000.00", false, 1 * day),
    mkBid(L.ethereal, USER1_ID, "155000.00", true, 2 * hour),

    mkBid(L.winter, USER1_ID, "75000.00", false, 2 * day),
    mkBid(L.winter, GOOGLE_TEST_ID, "82000.00", false, 1 * day),
    mkBid(L.winter, USER1_ID, "88000.00", true, 6 * hour),

    mkBid(L.anatomy, USER2_ID, "50000.00", false, 3 * day),
    mkBid(L.anatomy, APPLE_TEST_ID, "52500.00", false, 2 * day),
    mkBid(L.anatomy, USER2_ID, "55000.00", true, 1 * day),

    mkBid(L.chromatic, GOOGLE_TEST_ID, "195000.00", false, 4 * day),
    mkBid(L.chromatic, USER1_ID, "210000.00", true, 6 * hour),

    mkBid(L.suspended, USER1_ID, "34000.00", true, 1 * day),

    mkBid(L.void, USER1_ID, "95000.00", true, 1 * hour),

    mkBid(L.silent, GOOGLE_TEST_ID, "62000.00", false, 2 * day),
    mkBid(L.silent, USER2_ID, "67000.00", true, 1 * day),

    mkBid(L.golden, USER2_ID, "28000.00", true, 14 * day),

    mkBid(L.amber, USER1_ID, "360000.00", false, 45 * day),
    mkBid(L.amber, GOOGLE_TEST_ID, "380000.00", false, 40 * day),
    mkBid(L.amber, APPLE_TEST_ID, "400000.00", false, 35 * day),
    mkBid(L.amber, USER1_ID, "420000.00", true, 31 * day),

    mkBid(L.marginal, APPLE_TEST_ID, "95000.00", false, 40 * day),
    mkBid(L.marginal, USER1_ID, "115000.00", true, 32 * day),

    mkBid(L.paperThin, USER2_ID, "3200.00", true, 1 * day),

    mkBid(L.riverStudy, GOOGLE_TEST_ID, "4500.00", false, 3 * day),
    mkBid(L.riverStudy, USER1_ID, "5200.00", true, 1 * day),
  ];
  await db.insert(bid).values(bidRows);

  // ── Watchlists ─────────────────────────────────────────────────────────────
  await db.insert(watchlist).values([
    { userId: USER1_ID, lotId: L.ethereal },
    { userId: USER1_ID, lotId: L.winter },
    { userId: USER1_ID, lotId: L.chromatic },
    { userId: USER1_ID, lotId: L.futureStudy },
    { userId: USER2_ID, lotId: L.anatomy },
    { userId: USER2_ID, lotId: L.silent },
    { userId: USER2_ID, lotId: L.nocturnal },
    { userId: USER2_ID, lotId: L.paperThin },
  ]);

  await db.insert(saleFollow).values([
    { userId: USER1_ID, saleId: S.evening },
    { userId: USER2_ID, saleId: S.online },
    { userId: GOOGLE_TEST_ID, saleId: S.evening },
    { userId: GALLERY_ADMIN_ID, saleId: S.online },
  ]);

  // artist_watchlist now references artist_profile.id directly (post
  // 0046_artist_consolidation) — the legacy mapping to user.id is gone.
  await db.insert(artistWatchlist).values([
    { userId: USER1_ID, artistId: ARTIST.carolina },
    { userId: GOOGLE_TEST_ID, artistId: ARTIST.carolina },
    { userId: APPLE_TEST_ID, artistId: ARTIST.robert },
  ]);

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifId = () => randomUUID();
  await db.insert(notification).values([
    {
      id: notifId(),
      userId: GOOGLE_TEST_ID,
      type: "outbid",
      title: "You were outbid",
      message: "Robert Thorne placed a higher bid on The Winter Study.",
      lotId: L.winter,
      read: false,
      createdAt: new Date(now - 6 * 3_600_000),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "lot_ending_soon",
      title: "Auction ending soon",
      message: "Paper Thin Horizon closes in under 72 hours.",
      lotId: L.paperThin,
      read: true,
      createdAt: new Date(now - 12 * 3_600_000),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "payment_received",
      title: "Lot sold",
      message: "The Amber Hours has settled and payment has been captured.",
      lotId: L.amber,
      read: true,
      createdAt: new Date(now - 29 * day),
    },
    {
      id: notifId(),
      userId: USER1_ID,
      type: "lot_won",
      title: "You won an auction",
      message: "Congratulations — you won The Amber Hours for $420,000.",
      lotId: L.amber,
      read: false,
      createdAt: new Date(now - 30 * day),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "watchlist_starting",
      title: "Watched lot is starting",
      message: "Silent Architecture opens for bidding in under 30 minutes.",
      lotId: L.silent,
      read: false,
      createdAt: new Date(now - 1_800_000),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "payment_received",
      title: "Payment captured",
      message: "Stripe payment pi_seed_amber_captured was captured for The Amber Hours.",
      lotId: L.amber,
      read: false,
      createdAt: new Date(now - 29 * day + hour),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "lot_ended_seller",
      title: "Your lot has ended",
      message: "The Amber Hours sold for $420,000. Settlement is in progress.",
      lotId: L.amber,
      read: true,
      createdAt: new Date(now - 30 * day + hour),
    },
  ]);

  // ── Payments ───────────────────────────────────────────────────────────────
  const paymentRows: (Omit<
    typeof payment.$inferInsert,
    "buyerLegalEntityId" | "sellerLegalEntityId"
  > & {
    sellerId: string;
  })[] = [
    {
      id: PAY.amber,
      lotId: L.amber,
      buyerId: USER1_ID,
      sellerId: USER2_ID,
      amount: "525000.00",
      platformFee: "26250.00",
      stripePaymentIntentId: "pi_seed_amber_captured",
      stripeChargeId: "ch_seed_amber_captured",
      stripeRefundId: null,
      status: "captured",
      createdAt: new Date(now - 29 * day),
    },
    {
      id: PAY.marginal,
      lotId: L.marginal,
      buyerId: USER1_ID,
      sellerId: USER2_ID,
      amount: "143750.00",
      platformFee: "7187.50",
      stripePaymentIntentId: "pi_seed_marginal_pending",
      stripeChargeId: null,
      stripeRefundId: null,
      status: "pending",
      createdAt: new Date(now - 28 * day),
    },
    {
      id: PAY.golden,
      lotId: L.golden,
      buyerId: USER2_ID,
      sellerId: USER1_ID,
      amount: "35000.00",
      platformFee: "1750.00",
      stripePaymentIntentId: "pi_seed_golden_refunded",
      stripeChargeId: "ch_seed_golden_refunded",
      stripeRefundId: "re_seed_golden_full",
      status: "refunded",
      createdAt: new Date(now - 14 * day),
    },
    {
      id: PAY.manualReview,
      lotId: L.riverStudy,
      buyerId: ESTATE_OWNER_ID,
      sellerId: USER2_ID,
      amount: "87500.00",
      platformFee: "4375.00",
      stripePaymentIntentId: "pi_seed_river_manual_review",
      stripeChargeId: "ch_seed_river_manual_review",
      stripeRefundId: null,
      status: "requires_manual_review",
      createdAt: new Date(now - 3 * day),
    },
  ];
  await db.insert(payment).values(
    paymentRows.map(({ sellerId, buyerId, ...row }) => ({
      ...row,
      buyerId,
      buyerLegalEntityId: legalEntityIdForUser(buyerId),
      sellerLegalEntityId: legalEntityIdForUser(sellerId),
    })),
  );

  // ── Compliance & finance queue fixtures (deterministic E2E) ────────────────
  await db.insert(kycWatchlistScreening).values([
    {
      id: COMPLIANCE.amlPending,
      userId: KYC_PENDING_ID,
      provider: "veriff",
      providerSessionId: "veriff_seed_aml_pending",
      matchStatus: "possible_match",
      monitorStatus: "monitored",
      totalHits: 1,
      categories: ["sanction"],
      hits: [{ category: "sanction", name: "Seed Match" }],
      checkType: "initial_result",
      decisionOutcome: "review",
      reviewStatus: "pending",
      screenedAt: new Date(now - 2 * day),
      createdAt: new Date(now - 2 * day),
    },
    {
      id: COMPLIANCE.amlTriaged,
      userId: SUSPENDED_ID,
      provider: "veriff",
      providerSessionId: "veriff_seed_aml_triaged",
      matchStatus: "possible_match",
      monitorStatus: "monitored",
      totalHits: 2,
      categories: ["pep"],
      hits: [{ category: "pep", name: "Seed PEP Hit" }],
      checkType: "initial_result",
      decisionOutcome: "review",
      reviewStatus: "pending",
      triageRecommendation: "recommend_block",
      triagedByUserId: ADMIN_ID,
      triagedAt: new Date(now - 1 * day),
      triageNotes: "Seed triage — awaiting MLRO decision.",
      screenedAt: new Date(now - 5 * day),
      createdAt: new Date(now - 5 * day),
    },
  ]);

  await db.insert(sourceOfFunds).values([
    {
      id: COMPLIANCE.sofPending,
      userId: ESTATE_OWNER_ID,
      status: "pending",
      trigger: "threshold",
      thresholdAmount: "10000.00",
      exposureAmount: "87500.00",
      currency: "GBP",
      declaredSource: "Property sale proceeds (seed fixture).",
      evidence: ["seed/sof/estate-owner-bank-letter.pdf"],
      requestedDocumentTypes: ["bank_statement", "property_sale_agreement"],
      documentsRequestedAt: new Date(now - 3 * day),
      documentsRequestedByUserId: ADMIN_ID,
      documentRequestNote: "Please upload a recent bank statement and property sale agreement.",
      documentsSubmittedAt: new Date(now - 1 * day),
      createdAt: new Date(now - 2 * day),
      updatedAt: new Date(now - 1 * day),
    },
  ]);

  await db.insert(uploadObject).values([
    {
      id: UPLOAD.sofBankStatement,
      ownerUserId: ESTATE_OWNER_ID,
      kind: "source_of_funds_document",
      key: "seed/sof/estate-owner-bank-statement.pdf",
      declaredContentType: "application/pdf",
      declaredByteSize: 156_000,
      actualContentType: "application/pdf",
      actualByteSize: 156_000,
      status: "confirmed",
      createdAt: new Date(now - 2 * day),
      uploadedAt: new Date(now - 2 * day),
      validatedAt: new Date(now - 2 * day),
      expiresAt: new Date(now + 365 * day),
    },
    {
      id: UPLOAD.sofPropertySale,
      ownerUserId: ESTATE_OWNER_ID,
      kind: "source_of_funds_document",
      key: "seed/sof/estate-owner-property-sale.pdf",
      declaredContentType: "application/pdf",
      declaredByteSize: 248_000,
      actualContentType: "application/pdf",
      actualByteSize: 248_000,
      status: "confirmed",
      createdAt: new Date(now - 2 * day),
      uploadedAt: new Date(now - 2 * day),
      validatedAt: new Date(now - 2 * day),
      expiresAt: new Date(now + 365 * day),
    },
  ]);

  await db.insert(sourceOfFundsDocument).values([
    {
      id: SOF_DOC.bankStatement,
      sourceOfFundsId: COMPLIANCE.sofPending,
      uploadObjectId: UPLOAD.sofBankStatement,
      requestedType: "bank_statement",
      label: "January bank statement",
      reviewStatus: "pending",
      uploadedByUserId: ESTATE_OWNER_ID,
      uploadedAt: new Date(now - 2 * day),
    },
    {
      id: SOF_DOC.propertySale,
      sourceOfFundsId: COMPLIANCE.sofPending,
      uploadObjectId: UPLOAD.sofPropertySale,
      requestedType: "property_sale_agreement",
      label: "Property sale completion statement",
      reviewStatus: "pending",
      uploadedByUserId: ESTATE_OWNER_ID,
      uploadedAt: new Date(now - 2 * day),
    },
  ]);

  // ── Payouts ────────────────────────────────────────────────────────────────
  await db.insert(payout).values([
    {
      id: PO.paid,
      legalEntityId: LE.user2,
      periodStart: new Date(now - 35 * day),
      periodEnd: new Date(now - 25 * day),
      grossAmount: "525000.00",
      platformFee: "26250.00",
      stripeFee: "0.00",
      netAmount: "498750.00",
      currency: "GBP",
      status: "paid",
      stripeTransferId: "tr_seed_amber_paid",
      xeroBillId: "xero-bill-amber-seed",
      failureReason: null,
      processedAt: new Date(now - 24 * day),
      statementUrl: "https://assets.lax.bid/seed/statements/payout-amber.pdf",
      statementGenerationError: null,
      createdAt: new Date(now - 25 * day),
    },
    {
      id: PO.scheduledFailure,
      legalEntityId: LE.gallery,
      periodStart: new Date(now - 7 * day),
      periodEnd: new Date(now - 1 * day),
      grossAmount: "1200.00",
      platformFee: "60.00",
      stripeFee: "0.00",
      netAmount: "1140.00",
      currency: "GBP",
      status: "scheduled",
      stripeTransferId: null,
      xeroBillId: null,
      failureReason: "stripe_transfer_failed: account temporarily unavailable",
      processedAt: null,
      statementUrl: null,
      statementGenerationError: null,
      createdAt: new Date(now - 1 * day),
    },
    {
      id: PO.clawback,
      legalEntityId: LE.user1,
      periodStart: new Date(now - 15 * day),
      periodEnd: new Date(now - 14 * day),
      grossAmount: "-35000.00",
      platformFee: "0.00",
      stripeFee: "0.00",
      netAmount: "-35000.00",
      currency: "GBP",
      status: "clawback_pending",
      stripeTransferId: null,
      xeroBillId: null,
      failureReason: "manual_reconciliation_required: refunded after settlement window",
      processedAt: null,
      statementUrl: null,
      statementGenerationError: null,
      createdAt: new Date(now - 13 * day),
    },
  ]);

  await db.insert(payoutLine).values([
    {
      payoutId: PO.paid,
      paymentId: PAY.amber,
      amount: "525000.00",
      kind: "sale",
      createdByUserId: null,
      note: null,
      createdAt: new Date(now - 25 * day),
    },
    {
      payoutId: PO.scheduledFailure,
      paymentId: null,
      amount: "1200.00",
      kind: "adjustment",
      createdByUserId: ADMIN_ID,
      note: "Seed manual adjustment used to demonstrate scheduled payout retry after transfer failure.",
      createdAt: new Date(now - 1 * day),
    },
    {
      payoutId: PO.clawback,
      paymentId: PAY.golden,
      amount: "-35000.00",
      kind: "refund",
      createdByUserId: null,
      note: "Seed clawback after refund",
      sourceEventId: "evt_seed_golden_refund",
      createdAt: new Date(now - 13 * day),
    },
  ]);

  // ── Domain events ──────────────────────────────────────────────────────────
  await db.insert(domainEvent).values([
    {
      aggregateType: "payment",
      aggregateId: PAY.amber,
      eventType: "payment.captured",
      payload: {
        paymentId: PAY.amber,
        lotId: L.amber,
        buyerLegalEntityId: LE.user1,
        sellerLegalEntityId: LE.user2,
        amount: "525000.00",
        stripePaymentIntentId: "pi_seed_amber_captured",
        stripeChargeId: "ch_seed_amber_captured",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 29 * day),
    },
    {
      aggregateType: "payment",
      aggregateId: PAY.amber,
      eventType: "payment.dispute_opened",
      payload: {
        stripeDisputeId: STRIPE.disputeOpen,
        stripeChargeId: "ch_seed_amber_captured",
        paymentId: PAY.amber,
        amountCents: 52500000,
        currency: "gbp",
        reason: "fraudulent",
        sellerLegalEntityId: LE.user2,
        lotId: L.amber,
        buyerId: USER1_ID,
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: LE.user2,
      occurredAt: new Date(now - 5 * day),
    },
    {
      aggregateType: "payment",
      aggregateId: PAY.golden,
      eventType: "payment.dispute_opened",
      payload: {
        stripeDisputeId: STRIPE.disputeClosed,
        stripeChargeId: "ch_seed_golden_refunded",
        paymentId: PAY.golden,
        amountCents: 3500000,
        currency: "gbp",
        reason: "product_not_received",
        sellerLegalEntityId: LE.user1,
        lotId: L.golden,
        buyerId: USER2_ID,
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: LE.user1,
      occurredAt: new Date(now - 12 * day),
    },
    {
      aggregateType: "payment",
      aggregateId: PAY.golden,
      eventType: "payment.dispute_closed",
      payload: {
        stripeDisputeId: STRIPE.disputeClosed,
        paymentId: PAY.golden,
        outcome: "lost",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 2 * day),
    },
    {
      aggregateType: "payment",
      aggregateId: PAY.manualReview,
      eventType: "payment.requires_manual_review",
      payload: {
        paymentId: PAY.manualReview,
        lotId: L.riverStudy,
        buyerLegalEntityId: legalEntityIdForUser(ESTATE_OWNER_ID),
        sellerLegalEntityId: LE.user2,
        amount: "87500.00",
        reason: "high_value",
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: legalEntityIdForUser(ESTATE_OWNER_ID),
      occurredAt: new Date(now - 3 * day),
    },
    {
      aggregateType: "payout",
      aggregateId: PO.paid,
      eventType: "payout.transfer_initiated",
      payload: {
        payoutId: PO.paid,
        legalEntityId: LE.user2,
        stripeTransferId: "tr_seed_amber_paid",
        netAmount: "498750.00",
        currency: "GBP",
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: LE.user2,
      occurredAt: new Date(now - 25 * day),
    },
    {
      aggregateType: "payout",
      aggregateId: PO.scheduledFailure,
      eventType: "payout.transfer_failed",
      payload: {
        payoutId: PO.scheduledFailure,
        legalEntityId: LE.gallery,
        reason: "stripe_transfer_failed",
        retryMode: "next_cron_run",
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: LE.gallery,
      occurredAt: new Date(now - 1 * day),
    },
    {
      aggregateType: "payout",
      aggregateId: PO.clawback,
      eventType: "payout.clawback_required",
      payload: {
        payoutId: PO.clawback,
        legalEntityId: LE.user1,
        amount: "-35000.00",
        reason: "refund_after_payout",
      },
      producer: "seed",
      actorUserId: null,
      actingLegalEntityId: LE.user1,
      occurredAt: new Date(now - 13 * day),
    },
    // Entity lifecycle events
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.companyDocsRequested,
      eventType: "legal_entity.docs_requested",
      payload: {
        legalEntityId: LEO.companyDocsRequested,
        reason: "Companies House extract and director ID required before Stripe KYB can proceed.",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 12 * day),
    },
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.charityDocsReceived,
      eventType: "legal_entity.docs_received",
      payload: {
        legalEntityId: LEO.charityDocsReceived,
        uploadedDocumentKinds: ["companies_house_extract"],
      },
      producer: "seed",
      actorUserId: COMPANY_OWNER_ID,
      actingLegalEntityId: LEX.companyOwner,
      occurredAt: new Date(now - 9 * day),
    },
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.institutionUnderReview,
      eventType: "legal_entity.review_started",
      payload: {
        legalEntityId: LEO.institutionUnderReview,
        assignedToUserId: ADMIN_ID,
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 4 * day),
    },
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.otherRestricted,
      eventType: "legal_entity.restricted",
      payload: {
        legalEntityId: LEO.otherRestricted,
        reason: "Unresolved chargeback dispute; payout requires admin co-sign until resolved.",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 6 * day),
    },
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.dealerRejected,
      eventType: "legal_entity.rejected",
      payload: {
        legalEntityId: LEO.dealerRejected,
        reason: "Beneficial ownership documentation could not be verified; director IDs expired.",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 5 * day),
    },
    {
      aggregateType: "legal_entity",
      aggregateId: LEO.galleryArchived,
      eventType: "legal_entity.archived",
      payload: {
        legalEntityId: LEO.galleryArchived,
        reason:
          "Pop-up entity dissolved; all transactions migrated to primary Northbank Gallery entity.",
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 90 * day),
    },
    {
      aggregateType: "user",
      aggregateId: SUSPENDED_ID,
      eventType: "user.suspended",
      payload: {
        userId: SUSPENDED_ID,
        reason: "Chargeback dispute under investigation.",
        suspendedByUserId: ADMIN_ID,
      },
      producer: "seed",
      actorUserId: ADMIN_ID,
      actingLegalEntityId: LE.admin,
      occurredAt: new Date(now - 3 * day),
    },
  ]);

  // ── Projector state ────────────────────────────────────────────────────────
  // The app's projector service may re-insert these rows while the seed is
  // running, so we delete then upsert as close together as possible to avoid
  // a duplicate-key race with the running test-env service.
  await db.delete(projectorState);
  await db
    .insert(projectorState)
    .values([
      {
        projectorName: "notification_fanout",
        lastProcessedEventId: 0,
        updatedAt: stamp,
        lastError: "Seed state: projector has not processed seeded events yet.",
      },
      {
        projectorName: "xero_payout_bill_sync",
        lastProcessedEventId: 0,
        updatedAt: stamp,
        lastError: null,
      },
    ])
    .onConflictDoUpdate({
      target: projectorState.projectorName,
      set: { lastProcessedEventId: 0, updatedAt: stamp, lastError: null },
    });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  console.log("Seed complete — comprehensive LAX demo dataset loaded.");
  console.log("");
  console.log(`  Password for every seeded login: ${SEED_PASSWORD}`);
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────────────────┐");
  console.log("  │  Login accounts                                                         │");
  console.log("  ├──────────────────────────────┬──────────────────────┬───────────────────┤");
  console.log("  │  Email                        │  Name                │  Notes            │");
  console.log("  ├──────────────────────────────┼──────────────────────┼───────────────────┤");
  console.log("  │  admin@lax.bid               │  Eleanor Pereira     │  staff · super_admin │");
  console.log("  │  accountant@lax.bid          │  Erin Ledger         │  staff · finance_ops │");
  console.log(
    "  │  staff-auction-mgr@lax.bid   │  Alex Mercer         │  staff · auction_manager │",
  );
  console.log(
    "  │  staff-catalogue@lax.bid     │  Blair Chen          │  staff · catalogue_manager │",
  );
  console.log("  │  platform-specialist@lax.bid │  Cameron Webb        │  staff · specialist │");
  console.log(
    "  │  staff-ops@lax.bid           │  Dana Ortiz          │  staff · operations_fulfilment │",
  );
  console.log(
    "  │  staff-content@lax.bid       │  Elliot Rhodes       │  staff · content_marketing │",
  );
  console.log(
    "  │  staff-support@lax.bid       │  Fiona Nguyen        │  staff · support_concierge │",
  );
  console.log("  │  staff-readonly@lax.bid      │  Graham Holt         │  staff · staff_viewer │");
  console.log(
    "  │  staff-advisor@lax.bid       │  Hannah Price        │  staff · client_advisor │",
  );
  console.log("  │  staff-operations@lax.bid    │  Ian Brooks          │  staff · operations │");
  console.log(
    "  │  user1@lax.bid               │  Robert Thorne       │  client, KYC ✓, demo owner_user_id │",
  );
  console.log(
    "  │  user2@lax.bid               │  Carolina Price      │  client, demo owner_user_id     │",
  );
  console.log("  │  google-test@lax.bid         │  Google Test         │  Google OAuth     │");
  console.log("  │  apple-test@lax.bid          │  Apple Test          │  Apple OAuth      │");
  console.log("  │  gallery-admin@lax.bid       │  Maya Okafor         │  Northbank admin  │");
  console.log("  │  gallery-finance@lax.bid     │  Samir Patel         │  Northbank finance│");
  console.log("  ├──────────────────────────────┼──────────────────────┼───────────────────┤");
  console.log("  │  suspended@lax.bid           │  Isabelle Laurent    │  SUSPENDED        │");
  console.log("  │  unverified@lax.bid          │  Felix Nakamura      │  email unverified │");
  console.log("  │  bounced@lax.bid             │  Yara Siddiqui       │  email bounced    │");
  console.log("  │  kyc-pending@lax.bid         │  Marcus Obi          │  KYC processing   │");
  console.log("  │  kyc-rejected@lax.bid        │  Priya Mehta         │  KYC rejected     │");
  console.log("  │  estate-owner@lax.bid        │  Victoria Harrington │  estate org owner │");
  console.log("  │  company-owner@lax.bid       │  James Crowley       │  multi-org owner  │");
  console.log("  │  consignor@lax.bid           │  Lena Fischer        │  consignor+staff  │");
  console.log("  │  buyer-agent@lax.bid         │  Hassan Al-Rashid    │  buyer_agent role │");
  console.log("  │  viewer@lax.bid              │  Sofia Petrov        │  viewer role      │");
  console.log("  │  specialist@lax.bid          │  Dominic Ward        │  LAX specialist   │");
  console.log("  └──────────────────────────────┴──────────────────────┴───────────────────┘");
  console.log("");
  console.log("  Legal entity coverage:");
  console.log("    Subkinds     : private_collector · artist · gallery · dealer · estate");
  console.log("                   company · charity · institution · lax_stock · other");
  console.log("    Statuses     : lead · docs_requested · docs_received · under_review");
  console.log("                   connect_pending · approved · restricted · rejected · archived");
  console.log("    Member roles : owner · admin · consignor · finance · buyer_agent");
  console.log("                   viewer · specialist · staff  (+ 1 soft-deleted row)");
  console.log("");
  console.log("  User / auth coverage:");
  console.log("    Platform roles   : staff (+ required staff_role) · client (staff_role null)");
  console.log("    KYC states       : unverified · pending · approved · rejected");
  console.log("    Email statuses   : ok · bounced");
  console.log("    Suspended        : yes (Isabelle Laurent)");
  console.log("    Email unverified : yes (Felix Nakamura)");
  console.log("    OAuth fixtures   : Google · Apple");
  console.log("");
  console.log("  Invitations:");
  console.log("    Platform (all 4 statuses) : pending · accepted · revoked · expired");
  console.log("    Entity   (3 of 4 statuses): pending · accepted · revoked");
  console.log("");
  console.log(
    "  Also includes: 2 sales · 16 lots · 8 creator profiles · 26 bids · 8 watchlist rows",
  );
  console.log("  Creator registry kinds: artist · maker · studio · marque · manufacturer");
  console.log("                          author · mint · producer");
  console.log("  New departments: Motor Cars · Watches & Clocks · Books & Manuscripts");
  console.log("                   Coins & Medals · Design & Decorative Arts");
  console.log("  sale/artist follows · notifications · payments (captured/pending/refunded)");
  console.log("  payouts (paid/scheduled-retry/clawback) · KYB documents · domain events");
  console.log("  user addresses · legal entity addresses · retired payout method");
  console.log("");

  await pool.end();
}
