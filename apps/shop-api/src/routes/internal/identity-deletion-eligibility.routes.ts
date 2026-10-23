import { createHash, timingSafeEqual } from "node:crypto";
import {
  DELETION_ELIGIBILITY_SUBROUTE,
  INTERNAL_IDENTITY_ROUTE_PREFIX,
  type ProductDeletionEligibility,
} from "@auction/identity-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { IdentityDeletionRouteDeps } from "../../identity-route-deps.js";

/** Compares digests so neither the content nor the length of the secret is revealed by timing. */
function sameSecret(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== "string") return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

function machineCallerStatus(
  request: FastifyRequest,
  machine: IdentityDeletionRouteDeps["machine"],
): 200 | 401 | 503 {
  if (!machine.clientId || !machine.clientSecret) return 503;
  const authorised =
    sameSecret(request.headers["x-identity-client-id"], machine.clientId) &&
    sameSecret(request.headers["x-identity-client-secret"], machine.clientSecret);
  return authorised ? 200 : 401;
}

/**
 * Answers Identity's question "can this person delete their account, as far as LAX Shop and
 * lax.art are concerned?". Machine-authenticated with the shared Identity machine client, like
 * LAX Bid's equivalent route; the path comes from the shared contract. A failure to read the
 * data is a 503, never an empty list, so Identity treats it as "unavailable" and blocks.
 */
export async function registerIdentityDeletionEligibilityRoutes(
  app: FastifyInstance,
  deps: IdentityDeletionRouteDeps,
): Promise<void> {
  app.get(
    `${INTERNAL_IDENTITY_ROUTE_PREFIX}${DELETION_ELIGIBILITY_SUBROUTE}`,
    {
      schema: {
        tags: ["identity-internal"],
        params: Type.Object({ subjectId: Type.String({ minLength: 1, maxLength: 200 }) }),
      },
    },
    async (request, reply) => {
      const status = machineCallerStatus(request, deps.machine);
      if (status === 503)
        return reply.status(503).send({ error: "identity_machine_not_configured" });
      if (status === 401) return reply.status(401).send({ error: "unauthorized" });

      const { subjectId } = request.params as { subjectId: string };
      try {
        const answer: ProductDeletionEligibility = {
          product: "shop",
          blockers: await deps.eligibility.listBlockers(subjectId),
        };
        return reply.header("cache-control", "no-store").send(answer);
      } catch (error) {
        request.log.error({ err: error }, "shop_deletion_eligibility_failed");
        return reply.status(503).send({ error: "deletion_eligibility_unavailable" });
      }
    },
  );
}
