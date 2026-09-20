export class ShopPaymentWebhookError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = "ShopPaymentWebhookError";
    this.retryable = options.retryable;
  }
}
