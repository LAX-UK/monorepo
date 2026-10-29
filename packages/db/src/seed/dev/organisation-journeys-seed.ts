/**
 * Data the organisation role journeys (apps/web/e2e/org-roles-*.spec.ts) run against, on top of
 * the demo seed: Northbank Gallery gets an owner and a buyer agent with a bid limit, and there is
 * one thing for each role to do (a sale to bid in, an invoice to pay, a work that did not sell,
 * submissions to send, a payout statement).
 *
 * Dates here follow the wall clock, not the demo clock: bidding checks the real time, so the
 * lots a journey bids on must end in the future whenever the seed is run.
 */
import { inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../schema/index.js";
import { BUYER_AGENT_BID_LIMIT, ORGANISATION_JOURNEY_IDS } from "./organisation-journey-ids.js";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** The seeded people and organisations the journeys build on. */
export type OrganisationJourneyActors = {
  adminId: string;
  galleryAdminId: string;
  estateOwnerId: string;
  consignorId: string;
  buyerAgentId: string;
  /** Northbank Gallery: approved. */
  northbankId: string;
  /** An organisation whose bidding and selling are paused, owned by the estate owner. */
  restrictedId: string;
  /** Carolina Price's own account, the seller of the lots the journeys bid on. */
  sellerAccountId: string;
  /** The account that owns LAX's own stock, which creates the journeys' sale. */
  laxStockId: string;
  /** A catalogue category for the submissions. */
  categoryId: string;
  /** People the journeys sign in as; their interests questionnaire is marked done. */
  signInUserIds: string[];
};

const DAY = 86_400_000;
const IMAGE = "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80";

export async function seedOrganisationJourneys(db: Db, actors: OrganisationJourneyActors) {
  const ids = ORGANISATION_JOURNEY_IDS;
  const today = Date.now();
  const earlier = new Date(today - 1 * DAY);
  const later = new Date(today + 30 * DAY);
  const ended = new Date(today - 3 * DAY);
  const lotDefaults: Pick<
    typeof schema.lot.$inferInsert,
    | "sellerLegalEntityId"
    | "images"
    | "auctionType"
    | "buyerPremiumRate"
    | "dutchDecrementIntervalMs"
  > = {
    sellerLegalEntityId: actors.sellerAccountId,
    images: [IMAGE],
    auctionType: "english",
    buyerPremiumRate: "0.25",
    dutchDecrementIntervalMs: 60_000,
  };

  // The members who sign in for the journeys land on Home, not on the interests questionnaire.
  await db
    .update(schema.bidUserProfile)
    .set({ categoryInterestsOnboardingCompletedAt: new Date(today - 30 * DAY) })
    .where(inArray(schema.bidUserProfile.userId, actors.signInUserIds));

  // An owner and a buyer agent for Northbank, beside its admin, finance, consignor and viewer.
  await db.insert(schema.legalEntityMember).values([
    {
      legalEntityId: actors.northbankId,
      userId: actors.estateOwnerId,
      role: "owner",
      invitedByUserId: actors.adminId,
      invitedAt: new Date(today - 60 * DAY),
      acceptedAt: new Date(today - 59 * DAY),
    },
    {
      legalEntityId: actors.northbankId,
      userId: actors.buyerAgentId,
      role: "buyer_agent",
      invitedByUserId: actors.galleryAdminId,
      invitedAt: new Date(today - 40 * DAY),
      acceptedAt: new Date(today - 39 * DAY),
    },
  ]);

  await db.insert(schema.sale).values({
    id: ids.sale,
    title: "Northbank journeys online sale",
    description: "An open online sale the organisation role journeys bid in.",
    coverImages: [IMAGE],
    deliveryMode: "online",
    status: "active",
    startTime: earlier,
    endTime: later,
    previewStartTime: earlier,
    buyerPremiumRate: "0.25",
    terms: "Online bidding closes lot by lot.",
    createdByLegalEntityId: actors.laxStockId,
  });

  const lots: (typeof schema.lot.$inferInsert)[] = [
    // Two open lots: one the owner bids on, one the buyer agent bids on within and over a limit.
    {
      ...lotDefaults,
      id: ids.lotForOwner,
      saleId: ids.sale,
      lotNumber: 1,
      title: "Harbour Light, study for the owner",
      description: "An open lot the owner journey bids on.",
      startingPrice: "2000.00",
      currentPrice: "2000.00",
      minBidIncrement: "50.00",
      startTime: earlier,
      endTime: later,
      status: "active",
    },
    {
      ...lotDefaults,
      id: ids.lotForBuyerAgent,
      saleId: ids.sale,
      lotNumber: 2,
      title: "Harbour Light, study for the buyer agent",
      description: "An open lot the buyer agent journey bids on.",
      startingPrice: "5000.00",
      currentPrice: "5000.00",
      minBidIncrement: "100.00",
      startTime: earlier,
      endTime: later,
      status: "active",
    },
    // A consigned work that ended without selling, with no choice made yet.
    {
      ...lotDefaults,
      id: ids.lotUnsold,
      sellerLegalEntityId: actors.northbankId,
      title: "Quiet Tide, unsold",
      description: "A Northbank work that did not sell.",
      startingPrice: "3000.00",
      currentPrice: "3000.00",
      minBidIncrement: "100.00",
      startTime: new Date(today - 10 * DAY),
      endTime: ended,
      status: "ended",
      winnerId: null,
    },
    // Two invoices to pay: one for Northbank, one for the restricted organisation.
    {
      ...lotDefaults,
      id: ids.lotInvoiceNorthbank,
      title: "Harbour Light, won for Northbank",
      description: "Won for Northbank Gallery; the invoice is waiting to be paid.",
      startingPrice: "1500.00",
      currentPrice: "1800.00",
      minBidIncrement: "50.00",
      startTime: new Date(today - 10 * DAY),
      endTime: ended,
      status: "ended",
      winnerId: actors.estateOwnerId,
      buyerLegalEntityId: actors.northbankId,
    },
    {
      ...lotDefaults,
      id: ids.lotInvoiceRestricted,
      title: "Harbour Light, won for a paused organisation",
      description: "Won before the organisation was paused; the invoice is waiting to be paid.",
      startingPrice: "1200.00",
      currentPrice: "1400.00",
      minBidIncrement: "50.00",
      startTime: new Date(today - 10 * DAY),
      endTime: ended,
      status: "ended",
      winnerId: actors.estateOwnerId,
      buyerLegalEntityId: actors.restrictedId,
    },
  ];
  await db.insert(schema.lot).values(lots);

  await db.insert(schema.bid).values([
    {
      lotId: ids.lotInvoiceNorthbank,
      bidderId: actors.estateOwnerId,
      subjectId: actors.estateOwnerId,
      buyerLegalEntityId: actors.northbankId,
      amount: "1800.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      createdAt: new Date(today - 4 * DAY),
    },
    {
      lotId: ids.lotInvoiceRestricted,
      bidderId: actors.estateOwnerId,
      subjectId: actors.estateOwnerId,
      buyerLegalEntityId: actors.restrictedId,
      amount: "1400.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      createdAt: new Date(today - 4 * DAY),
    },
  ]);

  // The buyer agent: approved for the sale, authorised to bid for Northbank up to a limit.
  await db.insert(schema.saleRegistration).values({
    saleId: ids.sale,
    userId: actors.buyerAgentId,
    buyerLegalEntityId: actors.northbankId,
    status: "approved",
    requestedAt: earlier,
    decidedAt: earlier,
    decidedByUserId: actors.adminId,
  });
  await db.insert(schema.buyerAgentAuthorisation).values({
    legalEntityId: actors.northbankId,
    userId: actors.buyerAgentId,
    saleId: null,
    bidLimit: BUYER_AGENT_BID_LIMIT.toFixed(2),
    validFrom: earlier,
    validUntil: null,
    status: "active",
    createdByUserId: actors.galleryAdminId,
  });

  // The consignor's work: one complete draft to send, one the specialist sent back, and the
  // consignment behind the unsold lot.
  const submission: Omit<typeof schema.itemSubmission.$inferInsert, "id" | "title" | "status"> = {
    legalEntityId: actors.northbankId,
    submittedByUserId: actors.consignorId,
    description: "Oil on canvas, signed lower right, from the gallery's own collection.",
    medium: "Oil on canvas",
    dimensions: "30 × 40 in",
    images: [IMAGE],
    yearOfWork: "2019",
    isSigned: true,
    signatureNote: "Signed lower right.",
    conditionSelfReport: "Very good; no restoration.",
    provenance: [{ period: "2019", note: "Acquired from the artist by Northbank Gallery." }],
    askingPrice: "3500.00",
    reservePrice: "2800.00",
    createdAt: new Date(today - 6 * DAY),
    updatedAt: new Date(today - 2 * DAY),
  };
  const submissions: (typeof schema.itemSubmission.$inferInsert)[] = [
    {
      ...submission,
      id: ids.submissionDraft,
      title: "Coastal Notation, ready to send",
      status: "draft",
    },
    {
      ...submission,
      id: ids.submissionNeedsChanges,
      title: "Estuary at Dusk, needs changes",
      status: "changes_requested",
      reviewedBy: actors.adminId,
      reviewedAt: new Date(today - 2 * DAY),
      changesRequestedNote: "Please add a clearer photograph of the signature.",
      changesRequestedAt: new Date(today - 2 * DAY),
    },
    {
      ...submission,
      id: ids.submissionUnsold,
      title: "Quiet Tide, unsold",
      status: "converted",
      convertedLotId: ids.lotUnsold,
      reviewedBy: actors.adminId,
      reviewedAt: new Date(today - 20 * DAY),
    },
  ];
  await db.insert(schema.itemSubmission).values(submissions);
  await db.insert(schema.submissionCategories).values(
    [ids.submissionDraft, ids.submissionNeedsChanges, ids.submissionUnsold].map((submissionId) => ({
      submissionId,
      categoryId: actors.categoryId,
      sortOrder: 0,
    })),
  );

  // A settled payout with a statement, for finance to open.
  await db.insert(schema.payout).values({
    id: ids.payoutPaid,
    legalEntityId: actors.northbankId,
    periodStart: new Date(today - 40 * DAY),
    periodEnd: new Date(today - 30 * DAY),
    grossAmount: "4200.00",
    platformFee: "189.00",
    stripeFee: "0.00",
    netAmount: "4011.00",
    currency: "GBP",
    status: "paid",
    stripeTransferId: "tr_seed_northbank_paid",
    processedAt: new Date(today - 29 * DAY),
    statementUrl: "https://assets.lax.bid/seed/statements/payout-northbank.pdf",
    createdAt: new Date(today - 30 * DAY),
  });
}
