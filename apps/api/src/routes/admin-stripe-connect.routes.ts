import type { Hono } from "hono";
import { z } from "zod";
import { assertConnectUrlAllowed } from "../lib/stripe-connect-return-url.js";
import { respondStripeConnectRouteError } from "../lib/stripe-connect-route-errors.js";
import { zValidator } from "../lib/z-validator.js";
import { requireLegalEntityBrowse } from "../middleware/require-capability.js";
import type { IAdminStripeConnectApplicationService } from "../services/interfaces/admin-routes.js";

const legalEntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const linkBodySchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

/** Admin ops: sync Connect state and mint fallback onboarding links for sellers. */
export function attachAdminStripeConnectRoutes(
  platform: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  stripeConnect: IAdminStripeConnectApplicationService,
  failClosedOriginCheck = process.env.NODE_ENV === "production",
) {
  platform.post(
    "/legal-entities/:id/stripe-connect/sync",
    requireLegalEntityBrowse,
    zValidator("param", legalEntityIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      try {
        const status = await stripeConnect.syncAccountFromStripe(id);
        return c.json({ data: status });
      } catch (err) {
        const mapped = respondStripeConnectRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  platform.post(
    "/legal-entities/:id/stripe-connect/onboarding-link",
    requireLegalEntityBrowse,
    zValidator("param", legalEntityIdParamSchema),
    zValidator("json", linkBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        assertConnectUrlAllowed(body.returnUrl, stripeConnect.webOrigin, {
          failClosed: failClosedOriginCheck,
        });
        assertConnectUrlAllowed(body.refreshUrl, stripeConnect.webOrigin, {
          failClosed: failClosedOriginCheck,
        });
        const link = await stripeConnect.createOnboardingLink(id, body.returnUrl, body.refreshUrl);
        return c.json({ data: link });
      } catch (err) {
        const mapped = respondStripeConnectRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );
}
