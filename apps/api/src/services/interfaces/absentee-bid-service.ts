import type { LegalEntityMemberRole } from "@auction/types";
import type { Result } from "neverthrow";

export type AbsenteeBidServiceError = {
  message: string;
  status: number;
  code?: string;
  details?: Readonly<Record<string, string>>;
};

export interface IAbsenteeBidService {
  schedule(input: {
    userId: string;
    lotId: string;
    buyerLegalEntityId: string;
    /** The acting member's role on the account; decides whether the sale needs a registration. */
    memberRole?: LegalEntityMemberRole | undefined;
    maxAmount: number;
  }): Promise<Result<{ id: string }, AbsenteeBidServiceError>>;
  replayScheduledForLot(lotId: string): Promise<void>;
  /** Clears `executing` rows past lease (crash recovery). Safe for a cron; also called from replay. */
  expireStaleExecutingLeases(): Promise<void>;
}
