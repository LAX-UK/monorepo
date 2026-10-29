import { type EntityCapability, entityActorCan } from "@auction/domain";
import { createMiddleware } from "hono/factory";
import type { LegalEntityContext } from "./require-legal-entity-context.js";

const DEFAULT_FORBIDDEN_MESSAGE = "Your role in this organisation doesn't include this.";
const READ_ONLY_MESSAGE =
  "You're viewing this organisation as LAX support, so changes are turned off.";

/**
 * Requires the acting member to hold `capability` for the organisation named by
 * `X-Legal-Entity-Id`. Must run after the legal-entity context middleware, which has already
 * proved membership; a missing context is denied rather than assumed. A refusal keeps its stable
 * code in `error` and explains itself in `message`, which clients may show as it is.
 */
export function requireEntityCapability(
  capability: EntityCapability,
  forbiddenMessage: string = DEFAULT_FORBIDDEN_MESSAGE,
) {
  return createMiddleware<{ Variables: { legalEntityContext?: LegalEntityContext } }>(
    async (c, next) => {
      const ctx = c.get("legalEntityContext");
      if (!ctx || !entityActorCan(ctx, capability)) {
        const message = ctx?.isImpersonation ? READ_ONLY_MESSAGE : forbiddenMessage;
        return c.json(
          { error: "insufficient_entity_role", code: "insufficient_entity_role", message },
          403,
        );
      }
      await next();
    },
  );
}
