import type { FastifyInstance } from "fastify";
import type { StripeWebhookDeps } from "../../commerce-route-deps.js";
import { ShopPaymentWebhookError } from "../../errors/shop-payment-webhook.error.js";
function webhookFailureStatus(error: unknown): number {
  if (error instanceof ShopPaymentWebhookError) {
    return error.retryable ? 500 : 400;
  }
  return 500;
}

export async function registerStripeWebhookRoutes(
  app: FastifyInstance,
  deps: StripeWebhookDeps,
): Promise<void> {
  await app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookApp.post(
      "/webhooks/stripe",
      {
        bodyLimit: 256 * 1024,
      },
      async (request, reply) => {
        const signature = request.headers["stripe-signature"];
        if (typeof signature !== "string" || !deps.webhookSecret) {
          return reply.status(400).send("Webhook not configured");
        }
        const rawBody = request.body;
        if (!Buffer.isBuffer(rawBody)) {
          return reply.status(400).send("Invalid body");
        }
        let event: unknown;
        try {
          event = deps.verifyWebhook(rawBody, signature);
        } catch {
          return reply.status(400).send("Invalid signature");
        }

        const completed = deps.parseCheckoutSessionCompleted(event);
        if (completed) {
          try {
            const outcome = await deps.completeCheckout({
              eventId: completed.eventId,
              orderId: completed.orderId,
              amountTotalPence: completed.amountTotalPence,
              paidAt: completed.paidAt,
              customerEmail: completed.customerEmail ?? null,
            });
            if (outcome === "duplicate") {
              return reply.status(200).send({ received: true, duplicate: true });
            }
            return reply.status(200).send({ received: true });
          } catch (error) {
            request.log.error(
              { err: error, orderId: completed.orderId },
              "stripe checkout completion failed",
            );
            return reply.status(webhookFailureStatus(error)).send("Processing failed");
          }
        }

        const asyncFailed = deps.parseCheckoutSessionAsyncPaymentFailed(event);
        if (asyncFailed) {
          try {
            const outcome = await deps.failCheckout({
              eventId: asyncFailed.eventId,
              orderId: asyncFailed.orderId,
            });
            if (outcome === "duplicate") {
              return reply.status(200).send({ received: true, duplicate: true });
            }
            return reply.status(200).send({ received: true });
          } catch (error) {
            request.log.error(
              { err: error, orderId: asyncFailed.orderId },
              "stripe checkout async payment failure failed",
            );
            return reply.status(webhookFailureStatus(error)).send("Processing failed");
          }
        }

        const expired = deps.parseCheckoutSessionExpired(event);
        if (expired) {
          try {
            const outcome = await deps.expireCheckout({
              eventId: expired.eventId,
              orderId: expired.orderId,
            });
            if (outcome === "duplicate") {
              return reply.status(200).send({ received: true, duplicate: true });
            }
            return reply.status(200).send({ received: true });
          } catch (error) {
            request.log.error(
              { err: error, orderId: expired.orderId },
              "stripe checkout expiry failed",
            );
            return reply.status(webhookFailureStatus(error)).send("Processing failed");
          }
        }

        return reply.status(200).send({ received: true, ignored: true });
      },
    );
  });
}
