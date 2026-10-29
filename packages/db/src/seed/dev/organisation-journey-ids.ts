/**
 * Ids and limits the organisation role journeys share with the seed that creates their data.
 * Plain values only, so browser tests can import this file without loading the database schema.
 */
export const ORGANISATION_JOURNEY_IDS = {
  sale: "e1000010-0000-4000-8000-000000000010",
  lotForOwner: "b1000401-0000-4000-8000-000000000401",
  lotForBuyerAgent: "b1000402-0000-4000-8000-000000000402",
  lotUnsold: "b1000403-0000-4000-8000-000000000403",
  lotInvoiceNorthbank: "b1000404-0000-4000-8000-000000000404",
  lotInvoiceRestricted: "b1000405-0000-4000-8000-000000000405",
  submissionDraft: "d2000101-0000-4000-8000-000000000101",
  submissionNeedsChanges: "d2000102-0000-4000-8000-000000000102",
  submissionUnsold: "d2000103-0000-4000-8000-000000000103",
  payoutPaid: "a3000101-0000-4000-8000-000000000101",
} as const;

/** Highest bid the seeded buyer agent may place for Northbank, in pounds. */
export const BUYER_AGENT_BID_LIMIT = 6000;

/** Names of the seeded organisations the journeys act for. */
export const ORGANISATION_JOURNEY_NAMES = {
  approved: "Northbank Gallery",
  restricted: "Harrington Advisors",
  other: "Harrington Estate",
} as const;
