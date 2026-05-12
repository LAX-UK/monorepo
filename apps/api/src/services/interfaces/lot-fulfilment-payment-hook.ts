/** Hooks from lot fulfilment into the payment flow (DIP for {@link PaymentService}). */
export interface ILotFulfilmentPaymentHook {
  ensureAwaitingPayment(lotId: string, paymentId: string): Promise<void>;
  onPaymentCaptured(lotId: string, paymentId: string): Promise<void>;
}
