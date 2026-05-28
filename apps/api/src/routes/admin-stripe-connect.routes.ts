import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { assertConnectUrlAllowed } from "../lib/stripe-connect-return-url.js";
import { createRequireCapability } from "../middleware/require-capability.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import { StripeConnectNotConfiguredError } from "../services/interfaces/stripe-connect.js";

const legalEntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const linkBodySchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

const requireLegalEntityRead = createRequireCapability("legal_entity.read");

/** Admin ops: sync Connect state and mint fallback onboarding links for sellers. */
export function attachAdminStripeConnectRoutes(
  platform: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  stripeConnectService: IStripeConnectService,
  webOrigin: string | undefined,
  failClosedOriginCheck = process.env.NODE_ENV === "production",
) {
  platform.post(
    "/legal-entities/:id/stripe-connect/sync",
    requireLegalEntityRead,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      try {
        const status = await stripeConnectService.syncAccountFromStripe(id);
        return c.json({ data: status });
      } catch (err) {
        if (err instanceof StripeConnectNotConfiguredError) {
          return c.json({ error: "stripe_not_configured" }, 503);
        }
        if (err instanceof Error && err.message === "legal_entity_not_found") {
          return c.json({ error: "not_found" }, 404);
        }
        throw err;
      }
    },
  );

  platform.post(
    "/legal-entities/:id/stripe-connect/onboarding-link",
    requireLegalEntityRead,
    zValidator("param", legalEntityIdParamSchema),
    zValidator("json", linkBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        assertConnectUrlAllowed(body.returnUrl, webOrigin, { failClosed: failClosedOriginCheck });
        assertConnectUrlAllowed(body.refreshUrl, webOrigin, { failClosed: failClosedOriginCheck });
        const link = await stripeConnectService.createOnboardingLink(
          id,
          body.returnUrl,
          body.refreshUrl,
        );
        return c.json({ data: link });
      } catch (err) {
        if (err instanceof StripeConnectNotConfiguredError) {
          return c.json({ error: "stripe_not_configured" }, 503);
        }
        if (err instanceof Error && err.message.startsWith("connect_url_")) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  );
}
