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
