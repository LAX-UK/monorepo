import {
  DELETION_ELIGIBILITY_SUBROUTE,
  type ProductDeletionEligibility,
} from "@auction/identity-contracts";
import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import type { ContainerInternalIdentityDeletionEligibilityRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createIdentityMachineAuth } from "../middleware/identity-machine-auth.js";

/**
 * Answers Identity's question "can this person delete their account, as far as LAX Bid is
 * concerned?". Machine-authenticated like the other `/internal/identity` routes (mounted under
 * that prefix in app.ts); the route comes from the shared contract so Identity and Bid cannot
 * disagree about it.
 */
export function createInternalIdentityDeletionEligibilityRoutes(
  container: ContainerInternalIdentityDeletionEligibilityRoutesSlice,
  env: Pick<Env, "IDENTITY_MACHINE_CLIENT_ID" | "IDENTITY_MACHINE_CLIENT_SECRET">,
) {
  const routes = new Hono();
  routes.use("*", createIdentityMachineAuth(env));

  routes.get(DELETION_ELIGIBILITY_SUBROUTE, async (c) => {
    const subjectId = c.req.param("subjectId");
    try {
      const blockers = await container.accountDeletionEligibilityService.listBlockers(subjectId);
      const answer: ProductDeletionEligibility = { product: "bid", blockers };
      return c.json(answer);
    } catch (error) {
      Sentry.captureException(error);
      return c.json({ error: "deletion_eligibility_unavailable" }, 503);
    }
  });

  return routes;
}
