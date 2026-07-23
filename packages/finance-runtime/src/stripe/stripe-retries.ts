import Stripe from "stripe";

const maxRetries = 3;

function delayMs(attempt: number): Promise<void> {
  const ms = 2 ** attempt * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStripeError(
  err: InstanceType<typeof Stripe.errors.StripeError>,
  attempt: number,
): boolean {
  return (
    err.type === "StripeConnectionError" ||
    err.type === "StripeAPIError" ||
    (err.type === "StripeRateLimitError" && attempt < maxRetries)
  );
}

export async function executeWithStripeRetries<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        if (isRetryableStripeError(err, attempt) && attempt < maxRetries) {
          await delayMs(attempt);
          continue;
        }
        throw err;
      }
      throw err;
    }
  }
  throw new Error("executeWithStripeRetries: unreachable");
}
