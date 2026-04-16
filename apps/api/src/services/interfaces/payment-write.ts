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
  findById(id: string): Promise<PaymentRecord | null>;
  findOpenByAuctionAndBuyer(auctionId: string, buyerId: string): Promise<PaymentRecord | null>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
  /** All payments (admin listing). */
  listAll(): Promise<PaymentRecord[]>;
  /** Payments where the user is the buyer (portfolio). */
  listByBuyerId(buyerId: string): Promise<PaymentRecord[]>;
}
