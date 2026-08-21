import type { LegalEntityMemberRole } from "@auction/types";

export interface IBidLotRulesReader {
  findLotBidRules(lotId: string): Promise<{
    saleId: string | null;
    autoBidEnabled: boolean | null;
    minBidIncrement: string;
    autoBidStepMin: string | null;
    autoBidStepMax: string | null;
    autoBidStepPresets: number[] | null;
  } | null>;
}

export interface IBidMembershipReader {
  findActiveMemberRole(
    userId: string,
    legalEntityId: string,
  ): Promise<LegalEntityMemberRole | null>;
}

export interface IOperatorPlacementReader {
  findTelephoneBookingPlacement(
    bookingId: string,
  ): Promise<{ saleId: string; status: string } | null>;
  findTelephoneBookingCap(bookingId: string): Promise<{ reserveAltMax: string | null } | null>;
  findPaddleRegistration(
    saleId: string,
    paddleNumber: number,
  ): Promise<{ bidLimit: string | null; status: string } | null>;
}

export interface ISaleRegistrationBidReader {
  findRegistration(
    saleId: string,
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<{ status: string; bidLimit: string | null } | null>;
}

export interface IBuyerAgentAuthorisationReader {
  findActiveAuthorisations(input: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }): Promise<Array<{ saleId: string | null; bidLimit: string | null }>>;
}
