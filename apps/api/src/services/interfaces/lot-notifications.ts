/** Fan-out for lot lifecycle notifications (SRP vs LotService). */
export interface ILotNotificationCoordinator {
  notifyLotCancelled(args: {
    lotId: string;
    title: string;
    recipientIds: string[];
  }): Promise<void>;
}
