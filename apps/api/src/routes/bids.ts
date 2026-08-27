import { placeBidSchema } from "@auction/validators";
import type { ContainerBidRoutesSlice } from "../container.js";
import { respondBiddingRouteOutcome } from "../lib/bidding-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import {
  createBidUserRateLimitMiddleware,
  createBiddingKillSwitchMiddleware,
  createBuyerParticipationHono,
  createOptionalKycGate,
} from "../middleware/buyer-participation-policy.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export {
  BID_RL_HOUR_MAX,
  BID_RL_MINUTE_MAX,
  createBidUserRateLimitMiddleware,
} from "../middleware/buyer-participation-policy.js";

export function createBidRoutes(container: ContainerBidRoutesSlice, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const strictBidEligibilityEnabled = container.env?.STRICT_BID_ELIGIBILITY_ENABLED === true;
  const kycGate = createOptionalKycGate(container.kycService, strictBidEligibilityEnabled);
  const biddingKillSwitch = createBiddingKillSwitchMiddleware(container.env);
  const bidUserRateLimit = createBidUserRateLimitMiddleware(container.redis);
  const requireLegalEntity = container.requireSubmissionsLegalEntityContext;
  const r = createBuyerParticipationHono();

  r.post(
    "/",
    requireAuth,
    biddingKillSwitch,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    bidUserRateLimit,
    zValidator("json", placeBidSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const idem = c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
      const body = c.req.valid("json");
      const outcome = await container.bidding.placeBidHttp.placeBid({
        placedByUserId: userId,
        ...(legalEntityContext?.legalEntityId
          ? { buyerLegalEntityId: legalEntityContext.legalEntityId }
          : {}),
        ...(idem ? { idempotencyKey: idem } : {}),
        lotId: body.lotId,
        amount: body.amount,
        ...(body.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        ...(body.autoBidStepAmount !== undefined
          ? { autoBidStepAmount: body.autoBidStepAmount }
          : {}),
      });
      if (outcome.kind === "replay") {
        return c.json({ data: outcome.data }, 201);
      }
      return respondBiddingRouteOutcome(c, outcome, 201);
    },
  );

  return r;
}
