export interface IAccountDeletionEligibilityReader {
  getDeletionRequestedAt(userId: string): Promise<Date | null>;
  hasPendingPayment(userId: string): Promise<boolean>;
  hasActiveSellerLot(userId: string): Promise<boolean>;
  listActiveMembershipEntityIds(userId: string): Promise<string[]>;
  hasOpenPayoutForEntities(entityIds: string[]): Promise<boolean>;
}
