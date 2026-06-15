import type { Result } from "neverthrow";
import type { CheckInCandidateRow } from "../../repositories/drizzle-saleroom-check-in.repository.js";

export type SaleroomCheckInServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type SaleroomCheckInSuccess = {
  registrationId: string;
  paddleNumber: number;
  checkedInAt: Date;
  /** Present only when staff set a limit on this check-in. */
  bidLimit?: string;
};

export interface ISaleroomCheckInService {
  checkInBidder(input: {
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
    decidedByUserId: string;
    bidLimit?: number | undefined;
    paddleNumber?: number | undefined;
    laxNotes?: string | undefined;
  }): Promise<Result<SaleroomCheckInSuccess, SaleroomCheckInServiceError>>;

  searchCandidates(input: { saleId: string; q: string }): Promise<CheckInCandidateRow[]>;
}
