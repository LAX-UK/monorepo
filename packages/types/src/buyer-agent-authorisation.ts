import type { LegalEntityMemberRole } from "./legal-entity.js";

/** One buyer-agent authorisation, as the API returns it (dates are ISO strings). */
export type BuyerAgentAuthorisationView = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  /** `null` means every sale. */
  saleId: string | null;
  saleTitle: string | null;
  /** Decimal string in pounds, or `null` for no limit. */
  bidLimit: string | null;
  /** Most the agent may have committed at once, decimal pounds; `null` for no total. */
  totalLimit: string | null;
  validFrom: string;
  validUntil: string | null;
  status: "active" | "revoked";
  /** Active, but its start date has not arrived yet. */
  scheduled: boolean;
  /** Active, but its end date has passed. */
  expired: boolean;
  createdByName: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

/** A member who bids for the organisation only through an authorisation. */
export type AuthorisableBuyerAgent = {
  userId: string;
  name: string;
  email: string;
};

/** A sale an authorisation can be limited to. */
export type AuthorisableSale = {
  id: string;
  title: string;
  startTime: string;
};

/** Everything the authorisations panel needs, for clients and staff alike. */
export type BuyerAgentAuthorisationOverview = {
  canManage: boolean;
  buyerAgents: AuthorisableBuyerAgent[];
  authorisations: BuyerAgentAuthorisationView[];
  sales: AuthorisableSale[];
};

/** Whether the signed-in person may bid for the acting legal entity in a sale. */
export type BidAuthorityView =
  | {
      allowed: true;
      role: LegalEntityMemberRole;
      viaAuthorisation: boolean;
      /** Decimal string in pounds, or `null` for no limit. */
      bidLimit: string | null;
    }
  | {
      allowed: false;
      role: LegalEntityMemberRole | null;
      reason: "not_member" | "role_cannot_bid" | "authorisation_required";
    };

/**
 * One of the signed-in buyer agent's own authorisations that is in force now: for every sale
 * (`sale` is `null`) or for one sale, with whether they have registered in it yet.
 */
export type MyBuyerAgentAuthorisation = {
  sale: { id: string; title: string; startTime: string; registered: boolean } | null;
  /** Decimal string in pounds, or `null` for no limit. */
  bidLimit: string | null;
  validUntil: string | null;
};

/**
 * A limit on what is committed at once, with how much of it is in use. Exposure counts leading
 * and maximum bids on open lots, scheduled absentee bids and lots won and not yet paid for.
 * Amounts are decimal pounds.
 */
export type BiddingLimitUsage = {
  /** `null` when there is no such limit; exposure is still shown. */
  limit: string | null;
  exposure: string;
  /** Room left under the limit, never below zero; `null` when there is no limit. */
  available: string | null;
};

/** One buyer-agent authorisation in force now, with its limits and what the agent has used. */
export type AuthorisationLimitUsage = {
  authorisationId: string;
  userId: string;
  userName: string;
  /** `null` means every sale. */
  saleId: string | null;
  saleTitle: string | null;
  /** Per-lot limit, decimal pounds; `null` for no limit. */
  bidLimit: string | null;
  /** The total and the agent's own exposure within its scope (one sale, or every sale). */
  total: BiddingLimitUsage;
};

/**
 * The organisation's bidding limits for the Team "who can bid" view and Bid settings. Owners and
 * admins see every authorisation; a buyer agent sees their own.
 */
export type OrganisationBiddingLimitsView = {
  /** Whether the viewer may set or remove the organisation limit. */
  canManage: boolean;
  /** The organisation-wide limit, which applies to everyone who bids for it. */
  organisation: BiddingLimitUsage & { updatedAt: string | null };
  authorisations: AuthorisationLimitUsage[];
};
