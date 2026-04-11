export type CreatePaymentRow = {
  auctionId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  stripePaymentIntentId: string | null;
};

export type PaymentRecord = {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  stripePaymentIntentId: string | null;
  status: "pending" | "authorized" | "captured" | "refunded";
  createdAt: Date;
};

export interface IPaymentWriteRepository {
  create(row: CreatePaymentRow): Promise<PaymentRecord>;
}
