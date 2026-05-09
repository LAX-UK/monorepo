/** Full demo seed: wipes auth + app tables, then loads categories, users (with Better Auth
 * credential accounts), sales + lots (all statuses/types), bids, watchlist, notifications, payments.
 * * Run: DATABASE_URL=... pnpm --filter @auction/db db:seed
 * * Same password for every seeded account (email/password sign-in).
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { buildPgConnectionConfig } from "./ssl.js";

const { Pool } = pg;

/** One password for all seeded accounts — safe for local/staging only. */
const SEED_PASSWORD = "Password123!";

const ADMIN_ID = "admin-seed-001";
const ACCOUNTANT_ID = "accountant-seed-001";
const USER1_ID = "user-seed-001";
const USER2_ID = "user-seed-002";
const GOOGLE_TEST_ID = "user-seed-google";
const APPLE_TEST_ID = "user-seed-apple";
const GALLERY_ADMIN_ID = "gallery-admin-seed-001";
const GALLERY_FINANCE_ID = "gallery-finance-seed-001";

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
    case GALLERY_FINANCE_ID:
      return LE.gallery;
    default:
      throw new Error(`Missing seeded legal entity for user ${userId}`);
  }
};

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
} as const;

/** Sale ids — must be valid UUID hex only (PostgreSQL uuid type). */
const S = {
  evening: "e1000001-0000-4000-8000-000000000001",
  online: "e1000002-0000-4000-8000-000000000002",
} as const;

/** Fixed UUIDs for seeded item submissions (admin queue / demos). */
const SUB = {
  draft: "d2000001-0000-4000-8000-000000000001",
  submitted: "d2000002-0000-4000-8000-000000000002",
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
} as const;

const ARTIST = {
  carolina: "a1000001-0000-4000-8000-000000000001",
  robert: "a1000002-0000-4000-8000-000000000002",
  pendingStudio: "a1000003-0000-4000-8000-000000000003",
} as const;

const PAY = {
  amber: "90000001-0000-4000-8000-000000000001",
  marginal: "90000002-0000-4000-8000-000000000002",
  golden: "90000003-0000-4000-8000-000000000003",
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

async function clearAll(db: ReturnType<typeof drizzle<typeof schema>>) {
  const {
    adminReviewTask,
    artistAlias,
    artistProfile,
    artistWatchlist,
    emailEvent,
    emailOutbox,
    emailSuppression,
    domainEvent,
    jwksKey,
    kycVerification,
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
    saleCategories,
    sale,
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
  await db.delete(artistAlias);
  await db.delete(artistProfile);
  await db.delete(legalEntityDocument);
  await db.delete(legalEntityAddress);
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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool(buildPgConnectionConfig(url));
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const day = 86_400_000;
  const stamp = new Date();

  const {
    adminReviewTask,
    artistAlias,
    artistProfile,
    user,
    account,
    category,
    sale,
    saleCategories,
    lot,
    lotCategories,
    bid,
    watchlist,
    notification,
    payment,
    itemSubmission,
    submissionCategories,
    legalEntity,
    legalEntityAddress,
    legalEntityMember,
    legalEntityPayoutMethod,
    kycVerification,
    notificationPreference,
    payout,
    payoutLine,
    domainEvent,
    projectorState,
    saleFollow,
    artistWatchlist,
    externalAccount,
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

  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Eleanor Pereira",
      email: "admin@lax.bid",
      emailVerified: true,
      image: null,
      role: "administrator",
      createdAt: new Date(now - 180 * day),
      updatedAt: stamp,
    },
    {
      id: ACCOUNTANT_ID,
      name: "Erin Ledger",
      email: "accountant@lax.bid",
      emailVerified: true,
      image: null,
      role: "accountant",
      createdAt: new Date(now - 150 * day),
      updatedAt: stamp,
    },
    {
      id: USER1_ID,
      name: "Robert Thorne",
      email: "user1@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      createdAt: new Date(now - 120 * day),
      updatedAt: stamp,
    },
    {
      id: USER2_ID,
      name: "Carolina Price",
      email: "user2@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      createdAt: new Date(now - 45 * day),
      updatedAt: stamp,
    },
    {
      id: GOOGLE_TEST_ID,
      name: "Google Test",
      email: "google-test@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
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
      createdAt: new Date(now - 30 * day),
      updatedAt: stamp,
    },
    {
      id: GALLERY_ADMIN_ID,
      name: "Maya Okafor",
      email: "gallery-admin@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      createdAt: new Date(now - 75 * day),
      updatedAt: stamp,
    },
    {
      id: GALLERY_FINANCE_ID,
      name: "Samir Patel",
      email: "gallery-finance@lax.bid",
      emailVerified: true,
      image: null,
      role: "client",
      createdAt: new Date(now - 70 * day),
      updatedAt: stamp,
    },
  ]);

  await db
    .insert(account)
    .values([
      credentialAccount(ADMIN_ID),
      credentialAccount(ACCOUNTANT_ID),
      credentialAccount(USER1_ID),
      credentialAccount(USER2_ID),
      credentialAccount(GOOGLE_TEST_ID),
      credentialAccount(APPLE_TEST_ID),
      credentialAccount(GALLERY_ADMIN_ID),
      credentialAccount(GALLERY_FINANCE_ID),
    ]);

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

  await db.insert(legalEntity).values([
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
      vatNumber: "GB987654321",
      marginSchemeEligible: true,
      platformFeeBps: 500,
      createdAt: new Date(now - 20 * day),
      updatedAt: stamp,
    },
  ]);

  await db.insert(legalEntityMember).values([
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
    {
      legalEntityId: LE.restrictedDealer,
      userId: GALLERY_ADMIN_ID,
      role: "owner",
      isPrimaryAdmin: true,
      invitedByUserId: ADMIN_ID,
      invitedAt: new Date(now - 20 * day),
      acceptedAt: new Date(now - 19 * day),
    },
  ]);

  await db.insert(legalEntityAddress).values([
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
  ]);

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
  ]);

  await db.insert(kycVerification).values([
    {
      userId: USER1_ID,
      stripeVerificationSessionId: "vs_seed_robert_verified",
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
    {
      userId: USER2_ID,
      stripeVerificationSessionId: "vs_seed_carolina_verified",
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
    {
      userId: GALLERY_ADMIN_ID,
      stripeVerificationSessionId: "vs_seed_maya_requires_input",
      status: "requires_input",
      decisionPayload: { seeded: true, missing: ["document.front"] },
      createdAt: new Date(now - 8 * day),
      decisionAt: null,
    },
  ]);

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
  ]);

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
  ]);

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
        "Carolina Price works across oil, pigment, and assemblage. Her seeded profile powers artist registry, lot attribution, and featured artist UI states.",
      nationality: "British",
      location: "London, UK",
      birthYear: "1990",
      websiteUrl: "https://example.com/carolina-price",
      socialLinks: { instagram: "https://instagram.com/carolina.seed" },
      featured: true,
      verified: true,
      kind: "artist",
      status: "approved",
      createdByUserId: USER2_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 60 * day),
      reviewNotes: "Seeded approved artist profile linked to Carolina's legal entity.",
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
        "Collector-artist profile used for registry ownership and seller attribution demos.",
      nationality: "British",
      location: "Manchester, UK",
      birthYear: "1982",
      socialLinks: {},
      featured: false,
      verified: true,
      kind: "artist",
      status: "approved",
      createdByUserId: USER1_ID,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: new Date(now - 50 * day),
      reviewNotes: "Seeded secondary artist profile for admin registry tests.",
      ownerLegalEntityId: LE.user1,
      createdAt: new Date(now - 70 * day),
      updatedAt: stamp,
    },
    {
      id: ARTIST.pendingStudio,
      displayName: "Northbank Studio Archive",
      slug: "northbank-studio-archive",
      shortBio: "Pending gallery-managed artist/maker record for merge and review queues.",
      nationality: "British",
      location: "London, UK",
      socialLinks: {},
      featured: false,
      verified: false,
      kind: "maker",
      status: "pending",
      createdByUserId: GALLERY_ADMIN_ID,
      ownerLegalEntityId: LE.gallery,
      createdAt: new Date(now - 5 * day),
      updatedAt: stamp,
    },
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
      createdByUserId: GALLERY_ADMIN_ID,
    },
  ]);

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
      buyerPremiumRate: "0.25",
      terms: "LAX London Auction House buyer's premium is 25%; full conditions of sale apply.",
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
  ];
  await db.insert(sale).values(
    saleRows.map(({ categoryId: _categoryId, createdBy, ...row }) => ({
      ...row,
      createdByLegalEntityId: legalEntityIdForUser(createdBy),
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

  const lotRows: (Omit<typeof lot.$inferInsert, "sellerLegalEntityId"> & {
    categoryId: string;
    sellerId: string;
  })[] = [
    {
      id: L.ethereal,
      saleId: S.evening,
      lotNumber: 1,
      sellerId: USER2_ID,
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
        sellerArtistId: ARTIST.carolina,
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
  ];
  await db.insert(lot).values(
    lotRows.map(({ categoryId: _categoryId, sellerId, ...row }) => ({
      ...row,
      sellerLegalEntityId: legalEntityIdForUser(sellerId),
    })),
  );
  await db.insert(lotCategories).values(
    lotRows.map((row) => ({
      lotId: row.id as string,
      categoryId: row.categoryId,
      sortOrder: 0,
    })),
  );

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

  const hour = 3_600_000;
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

  await db.insert(artistWatchlist).values([
    { userId: USER1_ID, artistId: USER2_ID },
    { userId: GOOGLE_TEST_ID, artistId: USER2_ID },
    { userId: APPLE_TEST_ID, artistId: USER1_ID },
  ]);

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
      createdAt: new Date(now - 6 * 3600_000),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "ending_soon",
      title: "Auction ending soon",
      message: "Paper Thin Horizon closes in under 72 hours.",
      lotId: L.paperThin,
      read: true,
      createdAt: new Date(now - 12 * 3600_000),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "sale",
      title: "Lot sold",
      message: "The Amber Hours has settled and payment has been captured.",
      lotId: L.amber,
      read: true,
      createdAt: new Date(now - 29 * day),
    },
    {
      id: notifId(),
      userId: USER1_ID,
      type: "won",
      title: "You won an auction",
      message: "Congratulations — you won The Amber Hours for $420,000.",
      lotId: L.amber,
      read: false,
      createdAt: new Date(now - 30 * day),
    },
    {
      id: notifId(),
      userId: USER2_ID,
      type: "watchlist",
      title: "Lot update",
      message: "Silent Architecture has new bidding activity.",
      lotId: L.silent,
      read: false,
      createdAt: new Date(now - 1800_000),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "submission_received_for_review",
      title: "New submission awaiting review",
      message: "Robert Thorne submitted Bronze Maquette — field cast, 2024 for review.",
      lotId: null,
      read: false,
      createdAt: new Date(now - 1 * day),
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
      userId: USER1_ID,
      type: "submission_approved",
      title: "Submission approved",
      message: "Recursive Dreams has been approved and converted into a catalogued draft lot.",
      lotId: L.recursive,
      read: true,
      createdAt: new Date(now - 5 * day + hour),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "system",
      title: "Seed data loaded",
      message: "Demo catalog is ready for QA.",
      lotId: null,
      read: true,
      createdAt: stamp,
    },
  ]);

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
  ];
  await db.insert(payment).values(
    paymentRows.map(({ sellerId, buyerId, ...row }) => ({
      ...row,
      buyerId,
      buyerLegalEntityId: legalEntityIdForUser(buyerId),
      sellerLegalEntityId: legalEntityIdForUser(sellerId),
    })),
  );

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
  ]);

  await db.insert(projectorState).values([
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
  ]);

  console.log("");
  console.log("Seed complete — polished LAX demo dataset loaded.");
  console.log("");
  console.log(`  Password for every seeded login: ${SEED_PASSWORD}`);
  console.log("");
  console.log("  Login accounts:");
  console.log("    admin@lax.bid       Eleanor Pereira   administrator");
  console.log("    accountant@lax.bid  Erin Ledger       accountant");
  console.log("    user1@lax.bid       Robert Thorne     client");
  console.log("    user2@lax.bid       Carolina Price    client");
  console.log("    google-test@lax.bid Google Test       client / google fixture");
  console.log("    apple-test@lax.bid  Apple Test        client / apple fixture");
  console.log("    gallery-admin@lax.bid   Maya Okafor   Northbank Gallery admin");
  console.log("    gallery-finance@lax.bid Samir Patel   Northbank Gallery finance");
  console.log("");
  console.log("  Includes: 2 sales, 16 lots, nested categories, 26 bids, 8 watchlist rows,");
  console.log("  sale/artist follows, notifications, payments (captured/pending/refunded),");
  console.log("  payout rows (paid, scheduled retry, clawback_pending), domain events,");
  console.log("  KYC/Connect states, admin review tasks, and item submissions across");
  console.log("  draft, submitted, rejected, and converted states.");
  console.log("");

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
