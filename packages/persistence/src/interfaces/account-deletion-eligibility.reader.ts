export interface IAccountDeletionEligibilityReader {
  hasPendingPayment(userId: string): Promise<boolean>;
  hasActiveSellerLot(userId: string): Promise<boolean>;
  listActiveMembershipEntityIds(userId: string): Promise<string[]>;
  hasOpenPayoutForEntities(entityIds: string[]): Promise<boolean>;
}
