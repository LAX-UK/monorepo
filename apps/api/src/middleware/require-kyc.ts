import { createMiddleware } from "hono/factory";
import { type IKycService, KycRequiredError } from "../services/interfaces/kyc-service.js";

/** Enforces the KYC threshold for the authenticated user. Must run *after* * the auth middleware that sets `userId`.
 * * 402 + `{ error: 'kyc_required', summary: KycStatusSummary }` when the
 * user is over threshold and not yet `approved`.
 */
export function createRequireKyc(kyc: IKycService) {
  return createMiddleware<{ Variables: { userId?: string } }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      await kyc.enforceThreshold(userId);
    } catch (err) {
      if (err instanceof KycRequiredError) {
        return c.json({ error: err.code, summary: err.summary }, 402);
      }
      throw err;
    }
    await next();
  });
}
