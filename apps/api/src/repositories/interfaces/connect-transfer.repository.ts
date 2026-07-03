import type { legalEntity } from "@auction/db/schema";

export type ConnectTransferLegalEntity = typeof legalEntity.$inferSelect;

/** Read models for Connect payout transfer initiation. */
export interface IConnectTransferRepository {
  findLegalEntityById(legalEntityId: string): Promise<ConnectTransferLegalEntity | null>;
  findStripeChargeIdByPaymentId(paymentId: string): Promise<string | null>;
}
