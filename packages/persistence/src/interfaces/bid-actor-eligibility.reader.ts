import type { SelfServiceActorKycStatus } from "@auction/domain";

export type BidActorEligibilityRow = {
  emailVerified: boolean;
  kycStatus: SelfServiceActorKycStatus;
};

export interface IBidActorEligibilityReader {
  findBidActorEligibility(userId: string): Promise<BidActorEligibilityRow | null>;
}
