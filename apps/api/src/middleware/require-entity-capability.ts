import { type EntityCapability, entityActorCan } from "@auction/domain";
import { createMiddleware } from "hono/factory";
import type { LegalEntityContext } from "./require-legal-entity-context.js";

/**
 * Requires the acting member to hold `capability` for the organisation named by
 * `X-Legal-Entity-Id`. Must run after the legal-entity context middleware, which has already
 * proved membership; a missing context is denied rather than assumed.
 */
export function requireEntityCapability(capability: EntityCapability) {
  return createMiddleware<{ Variables: { legalEntityContext?: LegalEntityContext } }>(
    async (c, next) => {
      const ctx = c.get("legalEntityContext");
      if (!ctx || !entityActorCan(ctx, capability)) {
        return c.json({ error: "insufficient_entity_role" }, 403);
      }
      await next();
    },
  );
}
