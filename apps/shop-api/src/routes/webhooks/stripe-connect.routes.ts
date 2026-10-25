import type { FastifyInstance } from "fastify";

export type StripeConnectWebhookDeps = {
  webhookSecret: string | undefined;
  verifyWebhook(rawBody: Buffer, signature: string, webhookSecret: string): unknown;
  syncAccount(event: unknown): Promise<"applied" | "orphan" | "ignored">;
};

/** Connect endpoint: receives events from connected accounts on the lax.art platform. */
export async function registerStripeConnectWebhookRoutes(
  app: FastifyInstance,
  deps: StripeConnectWebhookDeps,
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
      "/webhooks/stripe/connect",
      { bodyLimit: 256 * 1024 },
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
          event = deps.verifyWebhook(rawBody, signature, deps.webhookSecret);
        } catch {
          return reply.status(400).send("Invalid signature");
        }
        try {
          const outcome = await deps.syncAccount(event);
          if (outcome === "orphan") {
            request.log.warn("stripe connect webhook for unknown connected account");
          }
          return reply.status(200).send({ received: true, outcome });
        } catch (error) {
          request.log.error({ err: error }, "stripe connect webhook processing failed");
          return reply.status(500).send("Processing failed");
        }
      },
    );
  });
}
