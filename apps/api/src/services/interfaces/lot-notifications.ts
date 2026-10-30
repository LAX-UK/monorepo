/** Fan-out for lot lifecycle notifications (SRP vs LotService). */
export interface ILotNotificationCoordinator {
  notifyLotCancelled(args: {
    lotId: string;
    title: string;
    /** Each person once, with the account the notice is about (`null`: personal). */
    recipients: { userId: string; legalEntityId: string | null }[];
  }): Promise<void>;
}
