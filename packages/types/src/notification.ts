export type UserNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  auctionId: string | null;
  read: boolean;
  createdAt: Date;
};
