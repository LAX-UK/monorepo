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

        try {
          const result = await deps.dispatchWebhook(event);
          if (result.kind === "checkout") {
            if (result.outcome === "duplicate") {
              return reply.status(200).send({ received: true, duplicate: true });
            }
            if (result.outcome === "terminal_acknowledged") {
              request.log.error("stripe paid webhook for terminal shop order");
              return reply.status(200).send({ received: true, terminal: true });
            }
            return reply.status(200).send({ received: true });
          }
          if (result.kind === "money") {
            if (result.outcome === "duplicate") {
              return reply.status(200).send({ received: true, duplicate: true });
            }
            if (result.outcome === "ignored") {
              return reply.status(200).send({ received: true, ignored: true });
            }
            return reply.status(200).send({ received: true });
          }
          return reply.status(200).send({ received: true, ignored: true });
        } catch (error) {
          request.log.error({ err: error }, "stripe webhook dispatch failed");
          return reply.status(webhookFailureStatus(error)).send("Processing failed");
        }
      },
    );
  });
}
