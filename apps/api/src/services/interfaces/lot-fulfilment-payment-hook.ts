export type LotFulfilmentAddressSnapshot = {
  addressId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
};

/** Hooks from lot fulfilment into the payment flow (DIP for {@link PaymentService}). */
export interface ILotFulfilmentPaymentHook {
  ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void>;
  onPaymentCaptured(lotId: string, paymentId: string): Promise<void>;
}
