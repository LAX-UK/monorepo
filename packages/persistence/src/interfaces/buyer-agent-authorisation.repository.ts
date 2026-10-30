import type { Database } from "@auction/db";

export type BuyerAgentAuthorisationStatus = "active" | "revoked";

/** One authorisation as the people managing it see it. */
export type BuyerAgentAuthorisationRecord = {
  id: string;
  legalEntityId: string;
  userId: string;
  userName: string;
  userEmail: string;
  /** `null` means every sale. */
  saleId: string | null;
  saleTitle: string | null;
  /** Decimal string in major units, or `null` for no limit. */
  bidLimit: string | null;
  /** Decimal string in major units, or `null` for no total. */
  totalLimit: string | null;
  validFrom: Date;
  validUntil: Date | null;
  status: BuyerAgentAuthorisationStatus;
  createdByUserId: string;
  createdByName: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

export type NewBuyerAgentAuthorisation = {
  legalEntityId: string;
  userId: string;
  saleId: string | null;
  bidLimit: string | null;
  /** Decimal string in major units, or `null` for no total. */
  totalLimit: string | null;
  validFrom: Date;
  validUntil: Date | null;
  createdByUserId: string;
};

/** Reads the authorisations an organisation has granted. */
export interface IBuyerAgentAuthorisationDirectory {
  /** Active authorisations first, then the most recently revoked, newest first within each. */
  listForLegalEntity(legalEntityId: string): Promise<BuyerAgentAuthorisationRecord[]>;
  findForLegalEntity(
    legalEntityId: string,
    authorisationId: string,
  ): Promise<BuyerAgentAuthorisationRecord | null>;
}

/** Grants and revokes authorisations. */
export interface IBuyerAgentAuthorisationWriter {
  /**
   * Records a new authorisation. An active one for the same member and scope (the same sale,
   * or all sales) is revoked with `supersededReason` in the same transaction, so a member never
   * holds two for one scope.
   */
  grant(
    input: NewBuyerAgentAuthorisation,
    supersededReason: string,
  ): Promise<{ id: string; supersededId: string | null }>;
  /** Revokes an active authorisation; `false` when it is not active (or not this entity's). */
  revoke(input: {
    legalEntityId: string;
    authorisationId: string;
    reason: string;
    revokedAt: Date;
  }): Promise<boolean>;
}

/** Ends a member's authorisations when they leave or stop being a buyer agent. */
export interface IMemberBuyerAgentAuthorisationRevoker {
  /**
   * Revokes every active authorisation `userId` holds for the organisation, in `tx`, and returns
   * the ones it revoked (none when they held none).
   */
  revokeAllForMember(
    tx: Database,
    input: { legalEntityId: string; userId: string; reason: string; revokedAt: Date },
  ): Promise<{ id: string; saleId: string | null }[]>;
}
