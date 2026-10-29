import type { PaymentAuthorityDecision } from "@auction/domain";
import type { Lot } from "@auction/types";

export type { PaymentAuthorityDecision, PaymentRefusal } from "@auction/domain";

/** The person asking to pay. */
export type PaymentActor = { userId: string };

/** What the authority needs to know about the won lot. */
export type PaymentAuthorityLot = Pick<Lot, "id" | "winnerId" | "buyerLegalEntityId">;

/**
 * Who may pay for a won lot: the winner of a personal purchase; for an organisation's purchase,
 * its active members who move its money. Checkout, `POST /payments` and the payment pipeline all
 * ask this one port, so the rule is decided once (`buyerPaymentAuthority` in the domain).
 */
export interface IBuyerPaymentAuthority {
  canPay(actor: PaymentActor, lot: PaymentAuthorityLot): Promise<PaymentAuthorityDecision>;
}
