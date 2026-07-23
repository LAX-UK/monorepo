import { Hono } from "hono";
import { z } from "zod";
import type { ContainerKycRoutesSlice } from "../container.js";
import { respondComplianceHttpJson } from "../lib/compliance-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const createSessionSchema = z.object({
  returnUrl: z.string().url(),
});

export function createKycRoutes(container: ContainerKycRoutesSlice, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const kycHttp = container.compliance.kycHttp;
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** GET /kyc/status — current KYC status, exposure, threshold, and requiresKyc flag. */
  r.get("/status", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await kycHttp.getStatus(userId);
    return respondComplianceHttpJson(c, response);
  });

  /** GET /kyc/session/latest — the most recent verification session for the user. */
  r.get("/session/latest", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await kycHttp.getLatestSession(userId);
    return respondComplianceHttpJson(c, response);
  });

  /** POST /kyc/session — create a new Veriff verification session.
   * Returns the verification URL for InContext SDK or redirect fallback.
   * Requires KYC to be configured (VERIFF_API_KEY and VERIFF_SHARED_SECRET).
   */
  r.post("/session", requireAuth, zValidator("json", createSessionSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const response = await kycHttp.createSession(userId, body.returnUrl);
    return respondComplianceHttpJson(c, response);
  });

  return r;
}
