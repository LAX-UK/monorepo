import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { KycNotConfiguredError } from "../services/interfaces/kyc-service.js";

const createSessionSchema = z.object({
  returnUrl: z.string().url(),
});

export function createKycRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** GET /kyc/status — current KYC status, exposure, threshold, and requiresKyc flag. */
  r.get("/status", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const summary = await container.kycService.getStatus(userId);
    return c.json({ data: summary });
  });

  /** GET /kyc/session/latest — the most recent verification session for the user. */
  r.get("/session/latest", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const latest = await container.kycService.getLatestForUser(userId);
    return c.json({ data: latest });
  });

  /** POST /kyc/session — create a new Stripe Identity verification session.
   * Returns the client_secret for the Stripe.js verifier and the hosted URL
   * fallback. Requires KYC to be configured (STRIPE_SECRET_KEY).
   */
  r.post("/session", requireAuth, zValidator("json", createSessionSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    try {
      const result = await container.kycService.createSession(userId, body.returnUrl);
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err instanceof KycNotConfiguredError) {
        return c.json({ error: "kyc_not_configured" }, 503);
      }
      throw err;
    }
  });

  return r;
}
